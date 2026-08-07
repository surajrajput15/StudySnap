import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';
import { validate, aiChatSchema, aiContentSchema, translateSchema } from '../middleware/validate';
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

function logAIRequest(endpoint: string, userId: string | undefined, body: Record<string, unknown>) {
  const content = body.content;
  const messages = body.messages;
  console.log(`[ai] 🧠 /${endpoint} userId=${userId || 'anonymous'} body=`, {
    ...body,
    content: (typeof content === 'string' ? content.substring(0, 80) : undefined) + '...',
    messages: Array.isArray(messages) ? messages.length : 0,
  });
}

function logAIError(endpoint: string, userId: string | undefined, error: unknown) {
  const err = error as { message?: string; stack?: string; status?: number };
  console.error(`[ai] ❌ /${endpoint} userId=${userId || 'anonymous'} error=`, {
    message: err.message,
    stack: err.stack?.substring(0, 200),
    status: err.status || 500,
  });
}

router.post('/chat', validate(aiChatSchema), async (req, res) => {
  const start = Date.now();
  try {
    const { messages } = req.body as z.infer<typeof aiChatSchema>;
    logAIRequest('chat', req.userId, req.body);
    const reply = await chatCompletion(messages);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /chat ${duration}ms — ${reply.substring(0, 60)}...`);
    res.json({ success: true, message: { role: 'assistant', content: reply }, _duration: duration });
  } catch (error) {
    logAIError('chat', req.userId, error);
    res.status(500).json({
      success: false,
      error: 'AI chat failed',
    });
  }
});

router.post('/summarize', validate(aiContentSchema), async (req, res) => {
  const start = Date.now();
  try {
    const { title, content } = req.body as z.infer<typeof aiContentSchema>;
    logAIRequest('summarize', req.userId, req.body);
    const summary = await summarizeNote(title || 'Untitled', content);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /summarize ${duration}ms`);
    res.json({ success: true, summary, _duration: duration });
  } catch (error) {
    logAIError('summarize', req.userId, error);
    res.status(500).json({ success: false, error: 'Summarization failed' });
  }
});

router.post('/mcqs', validate(aiContentSchema), async (req, res) => {
  const start = Date.now();
  try {
    const { title, content, type } = req.body as z.infer<typeof aiContentSchema> & { type?: string };
    logAIRequest('mcqs', req.userId, req.body);
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
    res.status(500).json({ success: false, error: 'MCQ generation failed' });
  }
});

router.post('/translate', validate(translateSchema), async (req, res) => {
  const start = Date.now();
  try {
    const { content, targetLanguage } = req.body as z.infer<typeof translateSchema>;
    logAIRequest('translate', req.userId, req.body);
    const lang = targetLanguage === 'hindi' ? 'hindi' : 'english';
    const translatedText = await translateText(content, lang);
    const duration = Date.now() - start;
    console.log(`[ai] ✓ /translate → ${lang} ${duration}ms`);
    res.json({ success: true, translatedText, _duration: duration });
  } catch (error) {
    logAIError('translate', req.userId, error);
    res.status(500).json({ success: false, error: 'Translation failed' });
  }
});

export default router;