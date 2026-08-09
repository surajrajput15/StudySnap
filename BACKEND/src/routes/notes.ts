import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { getDb, notes, categories } from '../db';
import { authMiddleware } from '../middleware/auth';
import { pinLimiter } from '../middleware/rateLimiter';
import { generateId } from '../utils/helpers';
import { hashPin, verifyPin } from '../utils/pin';
import { validate, noteSchema, verifyPinSchema } from '../middleware/validate';
import { cacheGet, cacheSet, invalidateUserCache } from '../services/cache';
import { CACHE_TTL_NOTES_SECONDS, DEFAULT_CATEGORIES } from '../config/constants';

const router = Router();

interface MockNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags?: string | null;
  isPinned?: boolean;
  isFavorite?: boolean;
  pinLock?: string | null;
  categoryId?: string | null;
  folderId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

type NoteWithoutPinLock = Omit<MockNote, 'pinLock'>;

let mockNotes: MockNote[] = [];

router.use(authMiddleware);

function stripPinLock(note: MockNote): NoteWithoutPinLock {
  const { pinLock: _pinLock, ...rest } = note;
  return rest;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const cacheKey = `${userId}:notes`;

    const cached = await cacheGet<Array<typeof notes.$inferSelect>>(cacheKey);
    if (cached) {
      res.json({ success: true, notes: cached.map(stripPinLock) });
      return;
    }

    const db = getDb();
    if (!db) {
      const filtered = mockNotes.filter(n => n.userId === userId);
      res.json({ success: true, notes: filtered.map(stripPinLock) });
      return;
    }

    const dbNotes = await db
      .select()
      .from(notes)
      .where(and(eq(notes.userId, userId), eq(notes.isArchived, false)))
      .orderBy(desc(notes.isPinned), desc(notes.updatedAt));

    await cacheSet(cacheKey, dbNotes, CACHE_TTL_NOTES_SECONDS);
    res.json({ success: true, notes: dbNotes.map(stripPinLock) });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch notes' });
  }
});

router.post('/', validate(noteSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id, title, content, tags, isPinned, isFavorite, pinLock, categoryId, folderId, createdAt } = req.body;

    const createdAtValue = createdAt ? new Date(createdAt) : undefined;

    const noteData = {
      title,
      content,
      tags: Array.isArray(tags) ? tags.join(',') : (tags || ''),
      isPinned: isPinned ?? false,
      isFavorite: isFavorite ?? false,
      pinLock: pinLock ? hashPin(pinLock) : null,
      categoryId: categoryId || null,
      folderId: folderId || null,
      updatedAt: new Date(),
    };

    const db = getDb();
    if (!db) {
      const existingIdx = mockNotes.findIndex(n => n.id === id && n.userId === userId);
      let result: MockNote;
      if (existingIdx !== -1) {
        result = { ...mockNotes[existingIdx], ...noteData, updatedAt: new Date().toISOString() };
        mockNotes[existingIdx] = result;
      } else {
        result = {
          id: id || generateId(),
          userId,
          ...noteData,
          createdAt: createdAtValue ? createdAtValue.toISOString() : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockNotes.push(result);
      }
      await invalidateUserCache(userId);
      res.json({ success: true, note: stripPinLock(result) });
      return;
    }

    let result;
    if (id) {
      const existing = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
      if (existing.length > 0) {
        const updated = await db.update(notes).set(noteData).where(and(eq(notes.id, id), eq(notes.userId, userId))).returning();
        result = updated[0];
      } else {
        const inserted = await db.insert(notes).values({ ...noteData, id, userId, ...(createdAtValue ? { createdAt: createdAtValue } : {}) }).returning();
        result = inserted[0];
      }
    } else {
      const inserted = await db.insert(notes).values({ ...noteData, userId, ...(createdAtValue ? { createdAt: createdAtValue } : {}) }).returning();
      result = inserted[0];
    }

    await invalidateUserCache(userId);
    res.json({ success: true, note: stripPinLock(result) });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to save note' });
  }
});

router.post('/verify-pin', pinLimiter, validate(verifyPinSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { noteId, pin } = req.body;

    let storedHash: string | null = null;

    const db = getDb();
    if (!db) {
      const note = mockNotes.find(n => n.id === noteId && n.userId === userId);
      storedHash = note?.pinLock || null;
    } else {
      const result = await db.select({ pinLock: notes.pinLock }).from(notes).where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
      storedHash = result[0]?.pinLock || null;
    }

    if (!storedHash) {
      res.status(404).json({ success: false, error: 'Note not found or no PIN set' });
      return;
    }

    const valid = verifyPin(pin, storedHash);
    res.json({ success: valid });
  } catch {
    res.status(500).json({ success: false, error: 'PIN verification failed' });
  }
});

router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.query.id as string;

    if (!id) {
      res.status(400).json({ success: false, error: 'ID required' });
      return;
    }

    const db = getDb();
    if (!db) {
      mockNotes = mockNotes.filter(n => !(n.id === id && n.userId === userId));
      await invalidateUserCache(userId);
      res.json({ success: true });
      return;
    }

    await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
    await invalidateUserCache(userId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete note' });
  }
});

router.get('/categories', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const db = getDb();
    if (!db) {
      res.json({ success: true, categories: DEFAULT_CATEGORIES });
      return;
    }

    const dbCategories = await db.select().from(categories).where(eq(categories.userId, userId));
    res.json({ success: true, categories: [...DEFAULT_CATEGORIES, ...dbCategories] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

export default router;