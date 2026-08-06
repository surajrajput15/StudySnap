import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate, revisionSchema } from '../middleware/validate';
import { computeNextRevision, generateId } from '../utils/helpers';

const router = Router();

interface RevisionLog {
  id: string;
  noteId: string;
  userId: string;
  revisedAt: string;
  rating: 'easy' | 'medium' | 'hard';
  nextScheduledAt: string;
}

let mockRevisionLogs: RevisionLog[] = [];
let mockNotesRevision: { [key: string]: { revisionStreak: number; lastRevisedAt: string; nextRevisionAt: string } } = {};

router.use(authMiddleware);

router.post('/mark', validate(revisionSchema), (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { noteId, rating } = req.body;

  const nextRev = computeNextRevision(rating);
  const now = new Date().toISOString();

  const log: RevisionLog = {
    id: generateId(),
    noteId,
    userId,
    revisedAt: now,
    rating,
    nextScheduledAt: nextRev.toISOString(),
  };
  mockRevisionLogs.push(log);

  const key = `${userId}:${noteId}`;
  const existing = mockNotesRevision[key] || { revisionStreak: 0, lastRevisedAt: '', nextRevisionAt: '' };
  mockNotesRevision[key] = {
    revisionStreak: existing.revisionStreak + 1,
    lastRevisedAt: now,
    nextRevisionAt: nextRev.toISOString(),
  };

  res.json({ success: true, log, noteRevision: mockNotesRevision[key] });
});

router.get('/logs', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const logs = mockRevisionLogs.filter(l => l.userId === userId);
  res.json({ success: true, logs });
});

router.get('/status/:noteId', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const noteId = req.params.noteId as string;
  const status = mockNotesRevision[`${userId}:${noteId}`] || null;
  res.json({ success: true, status });
});

export default router;
