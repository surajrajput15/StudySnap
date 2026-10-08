import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { getDb, quizzes, flashcardDecks, mindMaps } from '../db';
import { generateId } from '../utils/helpers';

const router = Router();
router.use(authMiddleware);

// In-memory fallback stores for test and dev modes
interface MockQuizItem {
  id: string;
  userId: string;
  noteId?: string | null;
  title: string;
  questions: string;
  totalQuestions: number;
  bestScore?: number | null;
  lastAttemptAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MockDeckItem {
  id: string;
  userId: string;
  noteId?: string | null;
  title: string;
  cards: string;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

interface MockMindMapItem {
  id: string;
  userId: string;
  noteId?: string | null;
  title: string;
  data: string;
  createdAt: string;
  updatedAt: string;
}

export const mockUserQuizzes: MockQuizItem[] = [];
export const mockUserDecks: MockDeckItem[] = [];
export const mockUserMindMaps: MockMindMapItem[] = [];

// ══════════════════════════════════════════════════════════
// Quizzes
// ══════════════════════════════════════════════════════════

router.get('/quizzes', async (req: Request, res: Response) => {
  const userId = req.userId!;
  try {
    const db = getDb();
    if (db) {
      try {
        const rows = await db
          .select()
          .from(quizzes)
          .where(eq(quizzes.userId, userId))
          .orderBy(desc(quizzes.updatedAt));
        res.json({
          success: true,
          quizzes: rows.map((r) => ({
            ...r,
            questions: JSON.parse(r.questions),
          })),
        });
        return;
      } catch {
        /* fallback */
      }
    }

    const userRows = mockUserQuizzes
      .filter((q) => q.userId === userId)
      .map((q) => ({
        ...q,
        questions: JSON.parse(q.questions),
      }));
    res.json({ success: true, quizzes: userRows });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch quizzes' });
  }
});

const saveQuizSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  noteId: z.string().uuid().optional().nullable(),
  questions: z.array(z.object({
    id: z.string().optional(),
    question: z.string().min(1),
    options: z.array(z.string()).min(2),
    correctIndex: z.number().int().min(0),
    explanation: z.string().optional(),
  })).min(1),
  bestScore: z.number().int().optional(),
});

router.post('/quizzes', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const parsed = saveQuizSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { id: incomingId, title, noteId, questions: qs, bestScore } = parsed.data;
  const id = incomingId || generateId();
  const now = new Date();
  const questionsStr = JSON.stringify(qs);

  try {
    const db = getDb();
    if (db) {
      try {
        await db.insert(quizzes).values({
          id,
          userId,
          title,
          noteId: noteId || null,
          questions: questionsStr,
          totalQuestions: qs.length,
          bestScore: bestScore ?? null,
          lastAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: quizzes.id,
          set: {
            title,
            questions: questionsStr,
            totalQuestions: qs.length,
            bestScore: bestScore ?? null,
            lastAttemptAt: now,
            updatedAt: now,
          },
        });
        res.json({ success: true, quiz: { id, title, totalQuestions: qs.length } });
        return;
      } catch {
        /* fallback */
      }
    }

    const existingIdx = mockUserQuizzes.findIndex((q) => q.id === id && q.userId === userId);
    const item: MockQuizItem = {
      id,
      userId,
      title,
      noteId: noteId || null,
      questions: questionsStr,
      totalQuestions: qs.length,
      bestScore: bestScore ?? null,
      lastAttemptAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    if (existingIdx >= 0) {
      mockUserQuizzes[existingIdx] = item;
    } else {
      mockUserQuizzes.unshift(item);
    }

    res.json({ success: true, quiz: { id, title, totalQuestions: qs.length } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to save quiz' });
  }
});

router.delete('/quizzes/:id', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : String(rawId);

  try {
    const db = getDb();
    if (db) {
      try {
        await db.delete(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.userId, userId)));
      } catch {
        /* fallback */
      }
    }

    const idx = mockUserQuizzes.findIndex((q) => q.id === id && q.userId === userId);
    if (idx >= 0) mockUserQuizzes.splice(idx, 1);

    res.json({ success: true, message: 'Quiz deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete quiz' });
  }
});

// ══════════════════════════════════════════════════════════
// Flashcard Decks
// ══════════════════════════════════════════════════════════

router.get('/flashcards', async (req: Request, res: Response) => {
  const userId = req.userId!;
  try {
    const db = getDb();
    if (db) {
      try {
        const rows = await db
          .select()
          .from(flashcardDecks)
          .where(eq(flashcardDecks.userId, userId))
          .orderBy(desc(flashcardDecks.updatedAt));
        res.json({
          success: true,
          decks: rows.map((r) => ({
            ...r,
            cards: JSON.parse(r.cards),
          })),
        });
        return;
      } catch {
        /* fallback */
      }
    }

    const userRows = mockUserDecks
      .filter((d) => d.userId === userId)
      .map((d) => ({
        ...d,
        cards: JSON.parse(d.cards),
      }));
    res.json({ success: true, decks: userRows });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch flashcards' });
  }
});

const saveDeckSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  noteId: z.string().uuid().optional().nullable(),
  cards: z.array(z.object({
    id: z.string().optional(),
    question: z.string().min(1),
    answer: z.string().min(1),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  })).min(1),
});

router.post('/flashcards', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const parsed = saveDeckSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { id: incomingId, title, noteId, cards } = parsed.data;
  const id = incomingId || generateId();
  const now = new Date();
  const cardsStr = JSON.stringify(cards);

  try {
    const db = getDb();
    if (db) {
      try {
        await db.insert(flashcardDecks).values({
          id,
          userId,
          title,
          noteId: noteId || null,
          cards: cardsStr,
          cardCount: cards.length,
          createdAt: now,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: flashcardDecks.id,
          set: {
            title,
            cards: cardsStr,
            cardCount: cards.length,
            updatedAt: now,
          },
        });
        res.json({ success: true, deck: { id, title, cardCount: cards.length } });
        return;
      } catch {
        /* fallback */
      }
    }

    const existingIdx = mockUserDecks.findIndex((d) => d.id === id && d.userId === userId);
    const item: MockDeckItem = {
      id,
      userId,
      title,
      noteId: noteId || null,
      cards: cardsStr,
      cardCount: cards.length,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    if (existingIdx >= 0) {
      mockUserDecks[existingIdx] = item;
    } else {
      mockUserDecks.unshift(item);
    }

    res.json({ success: true, deck: { id, title, cardCount: cards.length } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to save flashcards deck' });
  }
});

router.delete('/flashcards/:id', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : String(rawId);

  try {
    const db = getDb();
    if (db) {
      try {
        await db.delete(flashcardDecks).where(and(eq(flashcardDecks.id, id), eq(flashcardDecks.userId, userId)));
      } catch {
        /* fallback */
      }
    }

    const idx = mockUserDecks.findIndex((d) => d.id === id && d.userId === userId);
    if (idx >= 0) mockUserDecks.splice(idx, 1);

    res.json({ success: true, message: 'Flashcards deck deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete flashcards deck' });
  }
});

// ══════════════════════════════════════════════════════════
// Mind Maps
// ══════════════════════════════════════════════════════════

router.get('/mindmaps', async (req: Request, res: Response) => {
  const userId = req.userId!;
  try {
    const db = getDb();
    if (db) {
      try {
        const rows = await db
          .select()
          .from(mindMaps)
          .where(eq(mindMaps.userId, userId))
          .orderBy(desc(mindMaps.updatedAt));
        res.json({
          success: true,
          mindMaps: rows.map((r) => ({
            ...r,
            data: JSON.parse(r.data),
          })),
        });
        return;
      } catch {
        /* fallback */
      }
    }

    const userRows = mockUserMindMaps
      .filter((m) => m.userId === userId)
      .map((m) => ({
        ...m,
        data: JSON.parse(m.data),
      }));
    res.json({ success: true, mindMaps: userRows });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch mind maps' });
  }
});

const saveMindMapSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  noteId: z.string().uuid().optional().nullable(),
  data: z.record(z.unknown()),
});

router.post('/mindmaps', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const parsed = saveMindMapSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { id: incomingId, title, noteId, data } = parsed.data;
  const id = incomingId || generateId();
  const now = new Date();
  const dataStr = JSON.stringify(data);

  try {
    const db = getDb();
    if (db) {
      try {
        await db.insert(mindMaps).values({
          id,
          userId,
          title,
          noteId: noteId || null,
          data: dataStr,
          createdAt: now,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: mindMaps.id,
          set: {
            title,
            data: dataStr,
            updatedAt: now,
          },
        });
        res.json({ success: true, mindMap: { id, title } });
        return;
      } catch {
        /* fallback */
      }
    }

    const existingIdx = mockUserMindMaps.findIndex((m) => m.id === id && m.userId === userId);
    const item: MockMindMapItem = {
      id,
      userId,
      title,
      noteId: noteId || null,
      data: dataStr,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    if (existingIdx >= 0) {
      mockUserMindMaps[existingIdx] = item;
    } else {
      mockUserMindMaps.unshift(item);
    }

    res.json({ success: true, mindMap: { id, title } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to save mind map' });
  }
});

router.delete('/mindmaps/:id', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : String(rawId);

  try {
    const db = getDb();
    if (db) {
      try {
        await db.delete(mindMaps).where(and(eq(mindMaps.id, id), eq(mindMaps.userId, userId)));
      } catch {
        /* fallback */
      }
    }

    const idx = mockUserMindMaps.findIndex((m) => m.id === id && m.userId === userId);
    if (idx >= 0) mockUserMindMaps.splice(idx, 1);

    res.json({ success: true, message: 'Mind map deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete mind map' });
  }
});

export default router;
