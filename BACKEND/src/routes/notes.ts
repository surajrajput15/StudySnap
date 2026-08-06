import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { getDb, notes } from '../db';
import { authMiddleware } from '../middleware/auth';
import { pinLimiter } from '../middleware/rateLimiter';
import { parseTags, generateId } from '../utils/helpers';
import { hashPin, verifyPin } from '../utils/pin';
import { validate, noteSchema, verifyPinSchema as verifyPinSchemaDef } from '../middleware/validate';
import { cacheGet, cacheSet, cacheDel, invalidateUserCache } from '../services/cache';

const router = Router();

const DEFAULT_CATEGORIES = [
  { id: 'cat-physics', name: 'Physics', color: '#3B82F6' },
  { id: 'cat-chemistry', name: 'Chemistry', color: '#10B981' },
  { id: 'cat-maths', name: 'Maths', color: '#F59E0B' },
  { id: 'cat-biology', name: 'Biology', color: '#EC4899' },
  { id: 'cat-computer', name: 'Computer', color: '#8B5CF6' },
];

let mockNotes: any[] = [];

router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const cacheKey = `${userId}:notes`;

    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) {
      return res.json({ success: true, notes: cached.map(stripPinLock) });
    }

    if (!getDb()) {
      const filtered = mockNotes.filter(n => n.userId === userId);
      return res.json({ success: true, notes: filtered.map(stripPinLock) });
    }

    const dbNotes = await getDb()
      .select()
      .from(notes)
      .where(and(eq(notes.userId, userId), eq(notes.isArchived, false)))
      .orderBy(desc(notes.isPinned), desc(notes.updatedAt));

    await cacheSet(cacheKey, dbNotes, 60);
    res.json({ success: true, notes: dbNotes.map(stripPinLock) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch notes' });
  }
});

function stripPinLock(obj: any) {
  if (!obj) return obj;
  const { pinLock, ...rest } = obj;
  return rest;
}

router.post('/', validate(noteSchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id, title, content, tags, isPinned, isFavorite, pinLock, categoryId, folderId } = req.body;

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

    if (!getDb()) {
      const existingIdx = mockNotes.findIndex(n => n.id === id && n.userId === userId);
      let result;
      if (existingIdx !== -1) {
        result = { ...mockNotes[existingIdx], ...noteData, updatedAt: new Date().toISOString() };
        mockNotes[existingIdx] = result;
      } else {
        result = { id: id || generateId(), userId, ...noteData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        mockNotes.push(result);
      }
      await invalidateUserCache(userId);
      return res.json({ success: true, note: stripPinLock(result) });
    }

    let result;
    if (id) {
      const existing = await getDb().select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
      if (existing.length > 0) {
        const updated = await getDb().update(notes).set(noteData).where(and(eq(notes.id, id), eq(notes.userId, userId))).returning();
        result = updated[0];
      } else {
        const inserted = await getDb().insert(notes).values({ id, userId, ...noteData }).returning();
        result = inserted[0];
      }
    } else {
      const inserted = await getDb().insert(notes).values({ userId, ...noteData }).returning();
      result = inserted[0];
    }

    await invalidateUserCache(userId);
    res.json({ success: true, note: stripPinLock(result) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to save note' });
  }
});

router.post('/verify-pin', pinLimiter, validate(verifyPinSchemaDef), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { noteId, pin } = req.body;

    let storedHash: string | null = null;

    if (!getDb()) {
      const note = mockNotes.find(n => n.id === noteId && n.userId === userId);
      storedHash = note?.pinLock || null;
    } else {
      const result = await getDb().select({ pinLock: notes.pinLock }).from(notes).where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
      storedHash = result[0]?.pinLock || null;
    }

    if (!storedHash) {
      return res.status(404).json({ success: false, error: 'Note not found or no PIN set' });
    }

    const valid = verifyPin(pin, storedHash);
    res.json({ success: valid });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'PIN verification failed' });
  }
});

router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const id = req.query.id as string;

    if (!id) return res.status(400).json({ success: false, error: 'ID required' });

    if (!getDb()) {
      mockNotes = mockNotes.filter(n => !(n.id === id && n.userId === userId));
      await invalidateUserCache(userId);
      return res.json({ success: true });
    }

    await getDb().delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
    await invalidateUserCache(userId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to delete note' });
  }
});

router.get('/categories', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    if (!getDb()) {
      return res.json({ success: true, categories: DEFAULT_CATEGORIES });
    }

    const dbCategories = await getDb().select().from(require('../db').categories).where(eq(require('../db').categories.userId, userId));
    res.json({ success: true, categories: [...DEFAULT_CATEGORIES, ...dbCategories] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

export default router;
