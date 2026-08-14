import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';
import { validate, aiChatSchema, aiContentSchema, translateSchema } from '../middleware/validate';
import { aiRequestLogMeta } from '../utils/aiLogging';
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
    logAIRequest('chat', req.userId, aiRequestLogMeta(req.body));
    const reply = await chatCompletion(messages);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /chat ${duration}ms — ${reply.length} chars`);
    res.json({ success: true, message: { role: 'assistant', content: reply }, _duration: duration });
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
    logAIRequest('summarize', req.userId, aiRequestLogMeta(req.body));
    const summary = await summarizeNote(title || 'Untitled', content);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /summarize ${duration}ms`);
    res.json({ success: true, summary, _duration: duration });
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
    logAIRequest('mcqs', req.userId, aiRequestLogMeta(req.body));
    if (type === 'flashcard') {
      const flashcards = await generateFlashcards(title || 'Untitled', content);
      const duration = Date.now() - start;
      console.log(`[ai] ✓ /mcqs?type=flashcard ${duration}ms — ${flashcards.length} cards`);
      res.json({ success: true, flashcards, _duration: duration });
      return;
    }
    const mcqs = await generateMcqs(title || 'Untitled', content);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /mcqs ${duration}ms — ${mcqs.length} questions`);
    res.json({ success: true, mcqs, _duration: duration });
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
    logAIRequest('translate', req.userId, aiRequestLogMeta(req.body));
    const lang = targetLanguage === 'hindi' ? 'hindi' : 'english';
    const translatedText = await translateText(content, lang);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /translate → ${lang} ${duration}ms`);
    res.json({ success: true, translatedText, _duration: duration });
  } catch (error) {
    logAIError('translate', req.userId, error);
    const { status, body } = aiErrorBody(error, 'Translation failed');
    res.status(status).json(body);
  }
});

export default router;