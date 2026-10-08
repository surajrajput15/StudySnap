import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';
import { validate, aiChatSchema, aiContentSchema, aiQuizSchema, translateSchema } from '../middleware/validate';
import { aiRequestLogMeta } from '../utils/aiLogging';
import { cacheIncrBy } from '../services/cache';
import {
  AI_DAILY_REQUEST_QUOTA,
  AI_DAILY_CHAR_QUOTA,
  AI_QUOTA_TTL_SECONDS,
  AI_MODEL,
} from '../config/constants';
import {
  chatCompletion,
  summarizeNote,
  generateMcqs,
  generateFlashcards,
  generateMindMap,
  generateQuiz,
  translateText,
} from '../services/ai';
import { getFeatureFlagStatus, recordAiTelemetry } from '../middleware/rbac';

const router = Router();

router.use(authMiddleware);
router.use(aiLimiter);

// Check if an AI feature flag is active
async function checkFeatureAvailability(featureKey: string, res: Response): Promise<boolean> {
  const status = await getFeatureFlagStatus(featureKey);
  if (status === 'disabled') {
    res.status(503).json({
      success: false,
      error: 'This AI feature is temporarily disabled by platform administrators.',
      code: 'FEATURE_DISABLED',
    });
    return false;
  }
  if (status === 'maintenance') {
    res.status(503).json({
      success: false,
      error: 'This AI feature is undergoing scheduled maintenance. Please try again shortly.',
      code: 'FEATURE_MAINTENANCE',
    });
    return false;
  }
  return true;
}

function aiQuotaDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function secondsTillMidnightUTC(): number {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000));
}

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

  const [newReqs, newChars] = await Promise.all([
    cacheIncrBy(reqKey, 1, AI_QUOTA_TTL_SECONDS),
    cacheIncrBy(charKey, inputChars, AI_QUOTA_TTL_SECONDS),
  ]);
  if (newReqs === null || newChars === null) return true;
  if (isAiQuotaExceeded(newReqs, newChars)) {
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
  if (!(await checkFeatureAvailability('ai_assistant', res))) return;

  try {
    const { messages } = req.body as z.infer<typeof aiChatSchema>;
    const inputChars = messages.reduce((n, m) => n + m.content.length, 0);
    if (!(await checkAiQuota(req, res, inputChars))) return;
    logAIRequest('chat', req.userId, aiRequestLogMeta(req.body));
    const reply = await chatCompletion(messages);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /chat ${duration}ms — ${reply.length} chars`);

    void recordAiTelemetry({
      userId: req.userId,
      feature: 'ai_assistant',
      model: AI_MODEL,
      durationMs: duration,
      inputChars,
      outputChars: reply.length,
      success: true,
      statusCode: 200,
    });

    res.json({ success: true, message: { role: 'assistant', content: reply } });
  } catch (error) {
    logAIError('chat', req.userId, error);
    void recordAiTelemetry({
      userId: req.userId,
      feature: 'ai_assistant',
      model: AI_MODEL,
      durationMs: Date.now() - start,
      success: false,
      statusCode: (error as { status?: number })?.status || 500,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    const { status, body } = aiErrorBody(error, 'AI chat failed');
    res.status(status).json(body);
  }
});

router.post('/summarize', validate(aiContentSchema), async (req, res) => {
  const start = Date.now();
  if (!(await checkFeatureAvailability('ai_summary', res))) return;

  try {
    const { title, content } = req.body as z.infer<typeof aiContentSchema>;
    const inputChars = (title || '').length + content.length;
    if (!(await checkAiQuota(req, res, inputChars))) return;
    logAIRequest('summarize', req.userId, aiRequestLogMeta(req.body));
    const summary = await summarizeNote(title || 'Untitled', content);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /summarize ${duration}ms`);

    void recordAiTelemetry({
      userId: req.userId,
      feature: 'ai_summary',
      model: AI_MODEL,
      durationMs: duration,
      inputChars,
      outputChars: summary.length,
      success: true,
      statusCode: 200,
    });

    res.json({ success: true, summary });
  } catch (error) {
    logAIError('summarize', req.userId, error);
    void recordAiTelemetry({
      userId: req.userId,
      feature: 'ai_summary',
      model: AI_MODEL,
      durationMs: Date.now() - start,
      success: false,
      statusCode: (error as { status?: number })?.status || 500,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    const { status, body } = aiErrorBody(error, 'Summarization failed');
    res.status(status).json(body);
  }
});

router.post('/mcqs', validate(aiContentSchema), async (req, res) => {
  const start = Date.now();
  const { title, content, type } = req.body as z.infer<typeof aiContentSchema>;
  const featureKey = type === 'flashcard' ? 'ai_flashcards' : 'ai_mcq';

  if (!(await checkFeatureAvailability(featureKey, res))) return;

  try {
    const inputChars = (title || '').length + content.length;
    if (!(await checkAiQuota(req, res, inputChars))) return;
    logAIRequest('mcqs', req.userId, aiRequestLogMeta(req.body));
    if (type === 'flashcard') {
      const flashcards = await generateFlashcards(title || 'Untitled', content);
      const duration = Date.now() - start;
      console.log(`[ai] ✓ /mcqs?type=flashcard ${duration}ms — ${flashcards.length} cards`);

      void recordAiTelemetry({
        userId: req.userId,
        feature: 'ai_flashcards',
        model: AI_MODEL,
        durationMs: duration,
        inputChars,
        outputChars: JSON.stringify(flashcards).length,
        success: true,
        statusCode: 200,
      });

      res.json({ success: true, flashcards });
      return;
    }

    const mcqs = await generateMcqs(title || 'Untitled', content);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /mcqs ${duration}ms — ${mcqs.length} questions`);

    void recordAiTelemetry({
      userId: req.userId,
      feature: 'ai_mcq',
      model: AI_MODEL,
      durationMs: duration,
      inputChars,
      outputChars: JSON.stringify(mcqs).length,
      success: true,
      statusCode: 200,
    });

    res.json({ success: true, mcqs });
  } catch (error) {
    logAIError('mcqs', req.userId, error);
    void recordAiTelemetry({
      userId: req.userId,
      feature: featureKey,
      model: AI_MODEL,
      durationMs: Date.now() - start,
      success: false,
      statusCode: (error as { status?: number })?.status || 500,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    const { status, body } = aiErrorBody(error, 'MCQ generation failed');
    res.status(status).json(body);
  }
});

router.post('/mindmap', validate(aiContentSchema), async (req, res) => {
  const start = Date.now();
  if (!(await checkFeatureAvailability('ai_mindmap', res))) return;

  try {
    const { title, content } = req.body as z.infer<typeof aiContentSchema>;
    const inputChars = (title || '').length + content.length;
    if (!(await checkAiQuota(req, res, inputChars))) return;
    logAIRequest('mindmap', req.userId, aiRequestLogMeta(req.body));

    const mindMap = await generateMindMap(title || 'Main Topic', content);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /mindmap ${duration}ms`);

    void recordAiTelemetry({
      userId: req.userId,
      feature: 'ai_mindmap',
      model: AI_MODEL,
      durationMs: duration,
      inputChars,
      outputChars: JSON.stringify(mindMap).length,
      success: true,
      statusCode: 200,
    });

    res.json({ success: true, mindMap });
  } catch (error) {
    logAIError('mindmap', req.userId, error);
    void recordAiTelemetry({
      userId: req.userId,
      feature: 'ai_mindmap',
      model: AI_MODEL,
      durationMs: Date.now() - start,
      success: false,
      statusCode: (error as { status?: number })?.status || 500,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    const { status, body } = aiErrorBody(error, 'Mind map generation failed');
    res.status(status).json(body);
  }
});

router.post('/quiz', validate(aiQuizSchema), async (req, res) => {
  const start = Date.now();
  if (!(await checkFeatureAvailability('ai_quiz', res))) return;

  try {
    const { title, content, questionCount = 5 } = req.body as z.infer<typeof aiQuizSchema>;
    const inputChars = (title || '').length + content.length;
    if (!(await checkAiQuota(req, res, inputChars))) return;
    logAIRequest('quiz', req.userId, aiRequestLogMeta(req.body));

    const questions = await generateQuiz(title || 'Quiz', content, questionCount);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /quiz ${duration}ms — ${questions.length} questions`);

    void recordAiTelemetry({
      userId: req.userId,
      feature: 'ai_quiz',
      model: AI_MODEL,
      durationMs: duration,
      inputChars,
      outputChars: JSON.stringify(questions).length,
      success: true,
      statusCode: 200,
    });

    res.json({ success: true, quiz: { title: title || 'Practice Quiz', questions } });
  } catch (error) {
    logAIError('quiz', req.userId, error);
    void recordAiTelemetry({
      userId: req.userId,
      feature: 'ai_quiz',
      model: AI_MODEL,
      durationMs: Date.now() - start,
      success: false,
      statusCode: (error as { status?: number })?.status || 500,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    const { status, body } = aiErrorBody(error, 'Quiz generation failed');
    res.status(status).json(body);
  }
});

router.post('/translate', validate(translateSchema), async (req, res) => {
  const start = Date.now();
  if (!(await checkFeatureAvailability('ai_translate', res))) return;

  try {
    const { content, targetLanguage } = req.body as z.infer<typeof translateSchema>;
    if (!(await checkAiQuota(req, res, content.length))) return;
    logAIRequest('translate', req.userId, aiRequestLogMeta(req.body));
    const lang = targetLanguage === 'hindi' ? 'hindi' : 'english';
    const translatedText = await translateText(content, lang);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /translate → ${lang} ${duration}ms`);

    void recordAiTelemetry({
      userId: req.userId,
      feature: 'ai_translate',
      model: AI_MODEL,
      durationMs: duration,
      inputChars: content.length,
      outputChars: translatedText.length,
      success: true,
      statusCode: 200,
    });

    res.json({ success: true, translatedText });
  } catch (error) {
    logAIError('translate', req.userId, error);
    void recordAiTelemetry({
      userId: req.userId,
      feature: 'ai_translate',
      model: AI_MODEL,
      durationMs: Date.now() - start,
      success: false,
      statusCode: (error as { status?: number })?.status || 500,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    const { status, body } = aiErrorBody(error, 'Translation failed');
    res.status(status).json(body);
  }
});

export default router;