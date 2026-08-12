import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { voiceUploadLimiter } from '../middleware/rateLimiter';
import { getDb, voiceNotes, notes } from '../db';
import { MAX_FILE_SIZE_BYTES } from '../config/constants';
import {
  buildVoiceAudioPublicId,
  uploadVoiceAudio,
  destroyVoiceAudio,
  StorageConfigurationError,
} from '../services/storage';

const router = Router();

/**
 * Day 8 Task 1 (Phase 2) — real, Cloudinary-backed voice-note API.
 *
 * Replaces the in-memory mock from the earlier milestone. Audio bytes are stored
 * in Cloudinary via `services/storage.ts` (server-generated public IDs, no mock
 * fallback), and the returned secure URL is persisted to `voice_notes`.
 *
 * Every row is scoped to `req.userId` resolved from the Clerk session — the
 * client can never choose the owner. The client UUID is used as the primary key
 * so retries upsert idempotently, and an upsert whose UUID already belongs to a
 * DIFFERENT user is rejected (409) via an `onConflictDoUpdate` + `setWhere`
 * guard that never touches the other user's row.
 */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
});

// MIME types produced by the frontend MediaRecorder (audio/webm on Chromium,
// audio/mp4 on Safari) plus safe common containers. The client filename and
// extension are never trusted — only this allowlist is checked.
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/mpeg',
]);

// Multipart fields arrive as strings, so the shared JSON `validate` middleware
// cannot be used here; this route-local schema coerces/validates in place.
const voiceNoteUploadSchema = z.object({
  id: z.string().uuid('Voice note id must be a UUID'),
  noteId: z
    .string()
    .uuid('Linked note id must be a UUID')
    .nullable()
    .optional()
    .transform(v => (v === '' ? null : v)),
  duration: z.coerce.number().int('duration must be an integer').min(0).max(86400).optional(),
  transcript: z.string().max(50000, 'transcript must be at most 50,000 characters').optional(),
});

router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const db = getDb();
    if (!db) {
      res.status(503).json({ success: false, error: 'Voice notes are unavailable: database is not configured' });
      return;
    }

    const rows = await db
      .select()
      .from(voiceNotes)
      .where(eq(voiceNotes.userId, userId))
      .orderBy(desc(voiceNotes.createdAt));

    res.json({ success: true, voiceNotes: rows });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch voice notes' });
  }
});

router.post('/', voiceUploadLimiter, (req: Request, res: Response) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({
            success: false,
            error: `Audio file exceeds the maximum allowed size (${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB)`,
          });
          return;
        }
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      res.status(400).json({ success: false, error: 'Upload failed' });
      return;
    }
    void handleVoiceNoteUpload(req, res);
  });
});

async function handleVoiceNoteUpload(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, error: 'Audio file is required (field: file)' });
      return;
    }
    if (!ALLOWED_AUDIO_MIME_TYPES.has(file.mimetype)) {
      res.status(415).json({ success: false, error: `Unsupported audio type: ${file.mimetype}` });
      return;
    }

    const parsed = voiceNoteUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const { id, noteId, duration, transcript } = parsed.data;

    const db = getDb();
    if (!db) {
      res.status(503).json({ success: false, error: 'Voice notes are unavailable: database is not configured' });
      return;
    }

    // Note ownership is checked BEFORE any upload/persist: the linked note must
    // exist and belong to the authenticated user. Standalone memos (no noteId)
    // are allowed.
    if (noteId) {
      const owned = await db
        .select({ id: notes.id })
        .from(notes)
        .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
        .limit(1);
      if (owned.length === 0) {
        res.status(404).json({ success: false, error: 'Linked note not found or access denied' });
        return;
      }
    }

    // Upload bytes to Cloudinary FIRST; only persist the row once the audio is
    // durable. A failed upload (or missing config) never yields a fake URL.
    let audioUrl: string;
    try {
      const uploaded = await uploadVoiceAudio(file.buffer, buildVoiceAudioPublicId(userId, id));
      audioUrl = uploaded.secureUrl;
    } catch (error) {
      if (error instanceof StorageConfigurationError) {
        res.status(503).json({ success: false, error: error.message });
        return;
      }
      console.error('[voice-notes] Cloudinary upload failed:', error);
      res.status(500).json({ success: false, error: 'Failed to upload audio' });
      return;
    }

    const row = {
      id,
      userId,
      noteId: noteId ?? null,
      audioUrl,
      duration: duration ?? 0,
      transcript: transcript ?? null,
      updatedAt: new Date(),
    };

    let saved;
    try {
      saved = await db
        .insert(voiceNotes)
        .values(row)
        .onConflictDoUpdate({
          target: voiceNotes.id,
          set: {
            noteId: row.noteId,
            audioUrl: row.audioUrl,
            duration: row.duration,
            transcript: row.transcript,
            updatedAt: row.updatedAt,
          },
          setWhere: eq(voiceNotes.userId, userId),
        })
        .returning();
    } catch (error) {
      // DB write failed after the asset was uploaded: clean up the orphan
      // (best-effort) so a Cloudinary asset is never left without a DB row.
      try {
        await destroyVoiceAudio(buildVoiceAudioPublicId(userId, id));
      } catch {
        // best-effort cleanup
      }
      console.error('[voice-notes] DB upsert failed:', error);
      res.status(500).json({ success: false, error: 'Failed to save voice note' });
      return;
    }

    if (saved.length === 0) {
      // The id already exists but belongs to ANOTHER user: the setWhere guard
      // made the update a no-op. Remove the freshly uploaded asset (best-effort)
      // and reject — the other user's row is untouched.
      try {
        await destroyVoiceAudio(buildVoiceAudioPublicId(userId, id));
      } catch {
        // best-effort cleanup
      }
      res.status(409).json({ success: false, error: 'This voice note id already exists' });
      return;
    }

    res.json({ success: true, voiceNote: saved[0] });
  } catch (error) {
    console.error('[voice-notes] Unexpected error:', error);
    res.status(500).json({ success: false, error: 'Failed to save voice note' });
  }
}

router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.query.id;

    if (typeof id !== 'string' || !id) {
      res.status(400).json({ success: false, error: 'ID required' });
      return;
    }
    if (!z.string().uuid().safeParse(id).success) {
      res.status(400).json({ success: false, error: 'Invalid voice note id' });
      return;
    }

    const db = getDb();
    if (!db) {
      res.status(503).json({ success: false, error: 'Voice notes are unavailable: database is not configured' });
      return;
    }

    // Resolve by id AND owner so we never act on another user's row.
    const existing = await db
      .select()
      .from(voiceNotes)
      .where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, userId)));

    if (existing.length === 0) {
      // Idempotent: deleting a voice note that doesn't exist (or isn't ours)
      // still succeeds, mirroring the notes DELETE convention.
      res.json({ success: true });
      return;
    }

    // Best-effort Cloudinary destroy: 'not found' already resolves true inside
    // the service. If the destroy genuinely fails, the DB row is still removed
    // (source of truth) — a leftover asset is an orphan flagged for a future
    // sweep, but it must never block the delete.
    try {
      await destroyVoiceAudio(buildVoiceAudioPublicId(userId, id));
    } catch (error) {
      console.warn(`[voice-notes] Cloudinary destroy failed for ${id}:`, error);
    }

    await db.delete(voiceNotes).where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, userId)));
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete voice note' });
  }
});

export default router;
