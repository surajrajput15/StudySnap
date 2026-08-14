import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PIN_PATTERN, PIN_PATTERN_MESSAGE, MAX_NOTE_CONTENT_CHARS } from '../config/constants';

export function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      res.status(400).json({ success: false, error: 'Validation failed', details: errors });
      return;
    }
    req.body = result.data;
    next();
  };
}

export const noteSchema = z.object({
  id: z.string().uuid().optional(),
  createdAt: z.string().datetime().optional(),
  title: z.string().min(1, 'Title is required').max(500),
  content: z.string().max(MAX_NOTE_CONTENT_CHARS, `Content exceeds ${MAX_NOTE_CONTENT_CHARS} characters`),
  // Day 14 Task 2 — tags are capped in count (20) and length (50 chars each)
  // so an attacker cannot smuggle unbounded arrays or giant strings.
  tags: z.array(z.string().trim().min(1).max(50)).max(20).or(z.string().trim().max(50)).optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  pinLock: z.string().regex(PIN_PATTERN, PIN_PATTERN_MESSAGE).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  folderId: z.string().uuid().optional().nullable(),
}).strict();

export const aiChatSchema = z.object({
  // Day 14 Task 6 — the client may never supply a `system` role: the real
  // system prompt is server-side only, and letting a caller inject a `system`
  // message would let them override the assistant's instructions.
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1, 'Message content required').max(20000),
  })).min(1, 'At least one message required').max(100, 'Too many messages'),
}).strict();

export const aiContentSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().min(1, 'Content required').max(200000),
  // Day 14 Task 2 — the /mcqs handler reads `type` to route to flashcard
  // generation. Without this key zod stripped it from the parsed body, so
  // every `type: "flashcard"` request silently fell through to MCQs.
  type: z.enum(['mcq', 'flashcard']).optional(),
}).strict();

export const translateSchema = z.object({
  content: z.string().min(1, 'Content required').max(20000),
  targetLanguage: z.enum(['hindi', 'english']).optional(),
}).strict();

export const verifyPinSchema = z.object({
  noteId: z.string().uuid('Invalid note ID'),
  pin: z.string().regex(PIN_PATTERN, PIN_PATTERN_MESSAGE),
}).strict();

// Day 14 Task 2 — bounded shape validation for the (signature-verified) Clerk
// webhook. The svix signature is the real defense; these schemas just guarantee
// the server never trusts unbounded strings or an unknown event type. Kept here
// (not in routes/webhooks.ts) so they are unit-testable without importing the
// router + svix.
export const clerkEventSchema = z.object({
  type: z.string().min(1).max(100),
}).strict();

export const clerkUserCreatedDataSchema = z.object({
  id: z.string().min(1).max(200),
  first_name: z.string().max(200).optional(),
  last_name: z.string().max(200).optional(),
}).strict();