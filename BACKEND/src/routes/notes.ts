import { Router, Request, Response } from 'express';
import { eq, and, desc, gt } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, notes, categories, voiceNotes } from '../db';
import { authMiddleware } from '../middleware/auth';
import { pinLimiter } from '../middleware/rateLimiter';
import { generateId } from '../utils/helpers';
import { hashPin, verifyPin } from '../utils/pin';
import { checkNoteIdAvailability } from '../utils/noteOwnership';
import { computeCursor, isUpdatedAfter } from '../utils/delta';
import { validate, noteSchema, verifyPinSchema } from '../middleware/validate';
import { cacheGet, cacheSet, invalidateUserCache } from '../services/cache';
import { CACHE_TTL_NOTES_SECONDS, DEFAULT_CATEGORIES } from '../config/constants';
import { destroyVoiceAudio, isStorageConfigured, buildVoiceAudioPublicId } from '../services/storage';

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

/**
 * Day 7 Task 2 — sticky delete guard.
 *
 * The frontend already invalidates in-flight upserts the instant a note is
 * deleted, but a POST that survives a page reload can still reach this server
 * AFTER the DELETE and re-insert the note (the id is client-generated, so the
 * server cannot know the POST is stale). This bounded in-memory registry (keyed
 * by userId + noteId, TTL-bounded, lazy-purged) makes a DELETE sticky for a
 * short window: any upsert-by-id for a freshly-deleted note is rejected, so a
 * stale POST can never resurrect a deleted note. Account isolation is preserved
 * because every key carries the authenticated userId. Single-instance by design;
 * the client-side race fix already covers all same-session races.
 */
const DELETED_NOTE_TTL_MS = 10 * 60 * 1000;
const deletedNotes = new Map<string, number>();

function deletedNoteKey(userId: string, noteId: string): string {
  return `${userId}:${noteId}`;
}

function purgeExpiredDeletedNotes(): void {
  const now = Date.now();
  for (const [key, deletedAt] of deletedNotes) {
    if (now - deletedAt >= DELETED_NOTE_TTL_MS) deletedNotes.delete(key);
  }
}

function recordDeletedNote(userId: string, noteId: string): void {
  purgeExpiredDeletedNotes();
  deletedNotes.set(deletedNoteKey(userId, noteId), Date.now());
}

function isRecentlyDeleted(userId: string, noteId: string): boolean {
  const key = deletedNoteKey(userId, noteId);
  const deletedAt = deletedNotes.get(key);
  if (deletedAt === undefined) return false;
  if (Date.now() - deletedAt < DELETED_NOTE_TTL_MS) return true;
  deletedNotes.delete(key);
  return false;
}

router.use(authMiddleware);

function stripPinLock(note: MockNote): NoteWithoutPinLock {
  const { pinLock: _pinLock, ...rest } = note;
  return rest;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    // Day 16 Task 5 — optional, validated `?limit=1..200`. The local-first sync
    // contract pulls ALL notes (no limit sent), so default behavior is
    // unchanged; a limit lets list-style consumers bound the response.
    let limit: number | null = null;
    if (req.query.limit !== undefined) {
      const parsed = z.coerce.number().int().min(1).max(200).safeParse(req.query.limit);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid limit (must be an integer 1-200)' });
        return;
      }
      limit = parsed.data;
    }

    // Delta-sync cursor (P0): `?since=<RFC3339/ISO timestamp>`. When present,
    // ONLY notes whose updated_at is strictly after `since` are returned, plus a
    // `cursor` equal to the newest updated_at in the result (or `since` when no
    // row qualifies). A client that stores the cursor after each pull can do
    // incremental syncs. This is ADDITIVE: the default (no `since`) is the
    // original full pull, so the correctness of the LWW/tombstone merge is
    // unchanged for callers that never opt into delta mode.
    let since: Date | null = null;
    if (req.query.since !== undefined) {
      const raw = typeof req.query.since === 'string' ? req.query.since : String(req.query.since);
      const parsed = z.string().datetime().safeParse(raw);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid since (must be an ISO datetime)' });
        return;
      }
      since = new Date(parsed.data);
      if (Number.isNaN(since.getTime())) {
        res.status(400).json({ success: false, error: 'Invalid since (must be a valid datetime)' });
        return;
      }
    }

    const sinceISO = since ? since.toISOString() : null;

    const cacheKey = `${userId}:notes`;

    // Day 16 Task 4 — the cached payload is the STRIPPED shape (no pinLock
    // hashes) so Redis never holds sensitive material. Only the full-pull path
    // (no limit, no since) is cacheable; a slice or delta must always be live.
    if (limit === null && since === null) {
      const cached = await cacheGet<Array<NoteWithoutPinLock>>(cacheKey);
      if (cached) {
        res.json({ success: true, notes: cached });
        return;
      }
    }

    const db = getDb();
    if (!db) {
      // Mock path: honour `since` by filtering on updatedAt, and mirror the
      // cursor semantics of the DB path for API parity.
      let filtered = mockNotes.filter(n => n.userId === userId);
      if (sinceISO !== null) {
        filtered = filtered.filter((n) => isUpdatedAfter(n, sinceISO));
      }
      const sliced = filtered.slice(0, limit ?? undefined).map(stripPinLock);
      const cursor = sinceISO !== null
        ? computeCursor(filtered, sinceISO)
        : new Date().toISOString();
      res.json({
        success: true,
        notes: sliced,
        ...(sinceISO !== null ? { cursor } : {}),
      });
      return;
    }

    const filters = [eq(notes.userId, userId), eq(notes.isArchived, false)];
    if (since !== null) filters.push(gt(notes.updatedAt, since));

    const query = db
      .select()
      .from(notes)
      .where(and(...filters))
      .orderBy(desc(notes.isPinned), desc(notes.updatedAt));
    const dbNotes = limit !== null ? await query.limit(limit) : await query;

    const stripped = dbNotes.map(stripPinLock);
    if (since !== null) {
      // Delta mode: never cached (must always be live relative to the cursor).
      res.json({ success: true, notes: stripped, cursor: computeCursor(dbNotes, sinceISO!) });
      return;
    }
    // Full-pull mode: cacheable only when no limit bounds the slice.
    if (limit === null) await cacheSet(cacheKey, stripped, CACHE_TTL_NOTES_SECONDS);
    res.json({ success: true, notes: stripped });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch notes' });
  }
});

router.post('/', validate(noteSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id, title, content, tags, isPinned, isFavorite, pinLock, categoryId, folderId, createdAt } = req.body;

    // Reject a stale upsert-by-id for a note deleted within the sticky-guard
    // window so a late POST can never resurrect it after the DELETE.
    if (id && isRecentlyDeleted(userId, id)) {
      res.status(409).json({ success: false, error: 'This note was deleted.' });
      return;
    }

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
      // Day 16 Task 1 — update-first: attempt the UPDATE directly (scoped to
      // this account) instead of doing a SELECT then an UPDATE. Only when the
      // update matches no row (0 returned) do we distinguish "new note" from
      // "id belongs to someone else". Saves a round-trip on every edit.
      const updated = await db
        .update(notes)
        .set(noteData)
        .where(and(eq(notes.id, id), eq(notes.userId, userId)))
        .returning();
      if (updated.length > 0) {
        result = updated[0];
      } else {
        // Day 14 Task 3 — a caller-supplied id that ALREADY belongs to another
        // account must be rejected (409), never attempted as an INSERT that
        // collides on the primary key. Mirrors the voice-note upsert guard. The
        // cast narrows the real Drizzle builder to the minimal structural seam
        // the helper needs so the guard stays unit-testable with a fake DB.
        const availability = await checkNoteIdAvailability(db as unknown as Parameters<typeof checkNoteIdAvailability>[0], notes, id, userId);
        if (availability === 'taken') {
          res.status(409).json({ success: false, error: 'This note id already belongs to another account.' });
          return;
        }
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
    const id = req.query.id;

    if (typeof id !== 'string' || !id) {
      res.status(400).json({ success: false, error: 'ID required' });
      return;
    }
    if (!z.string().uuid().safeParse(id).success) {
      res.status(400).json({ success: false, error: 'Invalid note id' });
      return;
    }

    // Record the sticky delete guard BEFORE issuing the delete so any in-flight
    // upsert-by-id that lands afterwards (e.g. after a page reload) is rejected.
    recordDeletedNote(userId, id);

    const db = getDb();
    if (!db) {
      mockNotes = mockNotes.filter(n => !(n.id === id && n.userId === userId));
      await invalidateUserCache(userId);
      res.json({ success: true });
      return;
    }

    // Day 10 Task 1 — deleting a note cascade-deletes its voice_notes rows, but
    // the CLOUDINARY AUDIO survives unless destroyed explicitly. Purge the linked
    // assets first (best-effort: a storage failure must never block the note
    // delete). The public ID is deterministic: voice/<userId>/<voiceNoteId>.
    const cleanupAudio = async (): Promise<void> => {
      if (!isStorageConfigured()) return;
      try {
        const linked = await db
          .select({ id: voiceNotes.id })
          .from(voiceNotes)
          .where(and(eq(voiceNotes.noteId, id), eq(voiceNotes.userId, userId)));
        await Promise.allSettled(
          linked.map((vn) => destroyVoiceAudio(buildVoiceAudioPublicId(userId, vn.id)))
        );
      } catch (e) {
        console.warn(`[notes] Audio cleanup for deleted note ${id} failed:`, e);
      }
    };

    await cleanupAudio();
    await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
    await invalidateUserCache(userId);
    res.json({ success: true });
  } catch {
    // Roll back the sticky guard on a failed delete so a transient server error
    // can never reject legitimate updates to a note that still exists.
    const id = req.query.id;
    if (typeof id === 'string') deletedNotes.delete(deletedNoteKey(req.userId!, id));
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