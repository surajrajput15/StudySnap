import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../utils/helpers';
import { validate, voiceNoteSchema } from '../middleware/validate';

const router = Router();

interface MockVoiceNote {
  id: string;
  userId: string;
  noteId: string | null;
  audioUrl: string;
  duration: number;
  transcript: string | null;
  createdAt: string;
}

let mockVoiceNotes: MockVoiceNote[] = [];

router.use(authMiddleware);

router.get('/', (req: Request, res: Response) => {
  const userId = req.userId!;
  const notes = mockVoiceNotes.filter(vn => vn.userId === userId);
  res.json({ success: true, voiceNotes: notes });
});

router.post('/', validate(voiceNoteSchema), (req: Request, res: Response) => {
  const userId = req.userId!;
  const { id, noteId, audioUrl, duration, transcript } = req.body;

  const newVoiceNote: MockVoiceNote = {
    id: id || generateId(),
    userId,
    noteId: noteId || null,
    audioUrl,
    duration: duration || 0,
    transcript: transcript || null,
    createdAt: new Date().toISOString(),
  };

  mockVoiceNotes.push(newVoiceNote);
  res.json({ success: true, voiceNote: newVoiceNote });
});

router.delete('/', (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = req.query.id as string;

  if (!id) {
    res.status(400).json({ success: false, error: 'ID required' });
    return;
  }

  mockVoiceNotes = mockVoiceNotes.filter(vn => !(vn.id === id && vn.userId === userId));
  res.json({ success: true });
});

export default router;