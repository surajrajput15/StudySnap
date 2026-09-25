import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';
import { validate, aiChatSchema, aiContentSchema, translateSchema } from '../middleware/validate';
import { aiRequestLogMeta } from '../utils/aiLogging';
import { cacheIncrBy } from '../services/cache';
import {
  AI_DAILY_REQUEST_QUOTA,
  AI_DAILY_CHAR_QUOTA,
  AI_QUOTA_TTL_SECONDS,
} from '../config/constants';
import {
  chatCompletion,
  summarizeNote,
  generateMcqs,
  generateFlashcards,
  translateText,
} from '../services/ai';

const router = Router();

router.use(authMiddleware);
router.use(aiLimiter);

// Phase 1 P0: per-user daily AI budget (bill DoS guard). The per-IP
// aiLimiter (20/min) stops bursts; this stops sustained spend: 50 requests
// AND 500k input chars per user per UTC day, whichever hits first. Counters
// live in Redis with a 48h TTL; when Redis is down the check fails OPEN
// (null) so AI keeps working — availability beats strictness.
// Exceeding returns 429 with Retry-After (seconds till UTC midnight), which
// the frontend classifier already renders as a "busy" bubble.
function aiQuotaDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Exported for reuse (voice quota uses the same UTC-day Retry-After). */
export function secondsTillMidnightUTC(): number {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000));
}

/**
 * Exported for tests. Pure quota decision on POST-increment counters: null
 * means Redis is down → fail OPEN (false). Otherwise either budget exceeded
 * denies. Callers increment first so first-day counters always exist (a
 * check-then-increment design never created them and the quota never fired).
 */
export function isAiQuotaExceeded(
  newReqs: number | null,
  newChars: number | null
): boolean {
  if (newReqs === null || newChars === null) return false;
  return newReqs > AI_DAILY_REQUEST_QUOTA || newChars > AI_DAILY_CHAR_QUOTA;
}

async function checkAiQuota(
  req: { userId?: string },
  res: Response,
  inputChars: number
): Promise<boolean> {
  const userId = req.userId;
  if (!userId) return true;
  const day = aiQuotaDay();
  const reqKey = `ai_quota:req:${userId}:${day}`;
  const charKey = `ai_quota:chars:${userId}:${day}`;
  // Increment FIRST so first-day/first-user counters always come into
  // existence (a check-then-increment design saw only nulls and never
  // enforced anything). Redis down (null) → fail open.
  const [newReqs, newChars] = await Promise.all([
    cacheIncrBy(reqKey, 1, AI_QUOTA_TTL_SECONDS),
    cacheIncrBy(charKey, inputChars, AI_QUOTA_TTL_SECONDS),
  ]);
  if (newReqs === null || newChars === null) return true;
  if (isAiQuotaExceeded(newReqs, newChars)) {
    // Refund the reservation so denied attempts don't burn tomorrow's quota
    // math (best-effort; a lost refund only errs toward generosity).
    await Promise.all([
      cacheIncrBy(reqKey, -1, AI_QUOTA_TTL_SECONDS),
      cacheIncrBy(charKey, -inputChars, AI_QUOTA_TTL_SECONDS),
    ]).catch(() => {});
    res.set('Retry-After', String(secondsTillMidnightUTC()));
    res.status(429).json({ success: false, error: 'Daily AI limit reached. Try again tomorrow.' });
    return false;
  }
  return true;
}

// Day 8 Task 2 Phase 1 (B-7) — request/response logs carry operational
// metadata ONLY. User content is never logged: no messages, no message.content,
// no note content, no prompts, no titles, no conversation text.
function logAIRequest(endpoint: string, userId: string | undefined, meta: Record<string, unknown>) {
  console.log(`[ai] 🧠 /${endpoint} userId=${userId || 'anonymous'}`, meta);
}

function logAIError(endpoint: string, userId: string | undefined, error: unknown) {
  const err = error as { message?: string; stack?: string; status?: number };
  console.error(`[ai] ❌ /${endpoint} userId=${userId || 'anonymous'} error=`, {
    message: err.message,
    stack: err.stack?.substring(0, 200),
    status: err.status || 500,
  });
}

// Day 8 Task 3 (Phase C) — an unanswered production AI call surfaces as an
// explicit 503 ("not configured") instead of a generic 500, so the client and
// operators can tell "misconfigured" apart from "upstream failed".
// Day 10 Task 3 — an upstream Groq 429 (carried through by services/ai.ts)
// is ALSO surfaced as a real 429 with Retry-After absent, so the client's
// classifier shows a rate-limit message instead of a server-error one.
export function aiErrorBody(error: unknown, fallback: string): { status: number; body: { success: boolean; error: string } } {
  const err = error as { status?: number };
  if (err.status === 503) {
    return { status: 503, body: { success: false, error: 'AI is not configured in this environment.' } };
  }
  if (err.status === 429) {
    return { status: 429, body: { success: false, error: 'The AI service is busy. Please wait a moment and try again.' } };
  }
  return { status: 500, body: { success: false, error: fallback } };
}

router.post('/chat', validate(aiChatSchema), async (req, res) => {
  const start = Date.now();
  try {
    const { messages } = req.body as z.infer<typeof aiChatSchema>;
    const inputChars = messages.reduce((n, m) => n + m.content.length, 0);
    if (!(await checkAiQuota(req, res, inputChars))) return;
    logAIRequest('chat', req.userId, aiRequestLogMeta(req.body));
    const reply = await chatCompletion(messages);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /chat ${duration}ms — ${reply.length} chars`);
    res.json({ success: true, message: { role: 'assistant', content: reply } });
  } catch (error) {
    logAIError('chat', req.userId, error);
    const { status, body } = aiErrorBody(error, 'AI chat failed');
    res.status(status).json(body);
  }
});

router.post('/summarize', validate(aiContentSchema), async (req, res) => {
  const start = Date.now();
  try {
    const { title, content } = req.body as z.infer<typeof aiContentSchema>;
    if (!(await checkAiQuota(req, res, (title || '').length + content.length))) return;
    logAIRequest('summarize', req.userId, aiRequestLogMeta(req.body));
    const summary = await summarizeNote(title || 'Untitled', content);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /summarize ${duration}ms`);
    res.json({ success: true, summary });
  } catch (error) {
    logAIError('summarize', req.userId, error);
    const { status, body } = aiErrorBody(error, 'Summarization failed');
    res.status(status).json(body);
  }
});

router.post('/mcqs', validate(aiContentSchema), async (req, res) => {
  const start = Date.now();
  try {
    const { title, content, type } = req.body as z.infer<typeof aiContentSchema>;
    if (!(await checkAiQuota(req, res, (title || '').length + content.length))) return;
    logAIRequest('mcqs', req.userId, aiRequestLogMeta(req.body));
    if (type === 'flashcard') {
      const flashcards = await generateFlashcards(title || 'Untitled', content);
      const duration = Date.now() - start;
      console.log(`[ai] ✓ /mcqs?type=flashcard ${duration}ms — ${flashcards.length} cards`);
      res.json({ success: true, flashcards });
      return;
    }
    const mcqs = await generateMcqs(title || 'Untitled', content);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /mcqs ${duration}ms — ${mcqs.length} questions`);
    res.json({ success: true, mcqs });
  } catch (error) {
    logAIError('mcqs', req.userId, error);
    const { status, body } = aiErrorBody(error, 'MCQ generation failed');
    res.status(status).json(body);
  }
});

router.post('/translate', validate(translateSchema), async (req, res) => {
  const start = Date.now();
  try {
    const { content, targetLanguage } = req.body as z.infer<typeof translateSchema>;
    if (!(await checkAiQuota(req, res, content.length))) return;
    logAIRequest('translate', req.userId, aiRequestLogMeta(req.body));
    const lang = targetLanguage === 'hindi' ? 'hindi' : 'english';
    const translatedText = await translateText(content, lang);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /translate → ${lang} ${duration}ms`);
    res.json({ success: true, translatedText });
  } catch (error) {
    logAIError('translate', req.userId, error);
    const { status, body } = aiErrorBody(error, 'Translation failed');
    res.status(status).json(body);
  }
});

export default router;