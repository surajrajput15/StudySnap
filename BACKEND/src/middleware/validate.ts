import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors });
    }
    req.body = result.data;
    next();
  };
}

export const noteSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required').max(500),
  content: z.string(),
  tags: z.array(z.string()).or(z.string()).optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  pinLock: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits').optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  folderId: z.string().uuid().optional().nullable(),
});

export const aiChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(20000),
  })).min(1, 'At least one message required').max(100, 'Too many messages'),
});

export const aiContentSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().min(1, 'Content required').max(200000),
});

export const translateSchema = z.object({
  content: z.string().min(1, 'Content required').max(20000),
  targetLanguage: z.enum(['hindi', 'english']).optional(),
});

export const voiceNoteSchema = z.object({
  id: z.string().max(100).optional(),
  noteId: z.string().max(200).optional(),
  audioUrl: z.string().min(1).max(2048),
  duration: z.number().int().min(0).max(86400).optional(),
  transcript: z.string().max(50000).optional(),
});

export const revisionSchema = z.object({
  noteId: z.string().uuid('Invalid note ID'),
  rating: z.enum(['easy', 'medium', 'hard']),
});

export const verifyPinSchema = z.object({
  noteId: z.string().uuid('Invalid note ID'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});