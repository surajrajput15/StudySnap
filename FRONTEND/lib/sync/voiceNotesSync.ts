import { useStore, getStoreScopeKey, type VoiceNote } from '../store/useStore.ts';
import { API, apiFetch, apiFetchMultipart } from '../config.ts';
import { getVoiceAudioBlob, purgeOrphanedVoiceAudio } from '../storage/voiceNotes.ts';

/**
 * Day 8 Task 1 (Phase 3) — Voice-note sync layer.
 *
 * Responsibilities (VOICE NOTES ONLY):
 *  - Multipart upload of a pending local voice note's IndexedDB blob to the
 *    Cloudinary-backed backend, then marking the store row `synced` with the
 *    confirmed `audioUrl` (local IndexedDB stays the preferred playback source).
 *  - Local-first remote DELETE with a user-scoped tombstone so a deleted voice
 *    note can never resurrect on the next hydration/merge.
 *  - Hydration merge: newest-`updatedAt`-wins adoption of server rows, seeding
 *    of local-only pending notes, and safe orphan sweep of IndexedDB blobs not
 *    referenced by ANY account's metadata.
 *
 * Deliberately out of scope: note sync (notesSync.ts owns that), transcript
 * edits/rename re-uploads, and multi-device conflict resolution beyond LWW.
 */

const STORE_KEY_PREFIX = 'studysnap-store';
const VTOMBSTONE_PREFIX = 'studysnap:vtombstones';

/** Extracts the Clerk user id from an active store scope key, or null when the
 *  scope is the guest/anonymous store. */
function getScopeUserId(scope: string): string | null {
  const prefix = `${STORE_KEY_PREFIX}:`;
  if (!scope.startsWith(prefix)) return null;
  const userId = scope.slice(prefix.length);
  return userId || null;
}

function getVTombstoneKey(userId: string): string {
  return `${VTOMBSTONE_PREFIX}:${userId}`;
}

/** Reads the current user's deleted voice-note ids. Never throws — a corrupt or
 *  unavailable localStorage simply yields an empty set so sync still works. */
function readVTombstones(userId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(getVTombstoneKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

/** Persists the tombstone set. Best-effort: a storage failure must never throw. */
function writeVTombstones(userId: string, tombstones: Set<string>): void {
  try {
    window.localStorage.setItem(getVTombstoneKey(userId), JSON.stringify([...tombstones]));
  } catch {
    // ignore — tombstones are best-effort durability
  }
}

function addVTombstone(userId: string, voiceNoteId: string): void {
  const tombstones = readVTombstones(userId);
  tombstones.add(voiceNoteId);
  writeVTombstones(userId, tombstones);
}

function removeVTombstone(userId: string, voiceNoteId: string): void {
  const tombstones = readVTombstones(userId);
  if (!tombstones.has(voiceNoteId)) return;
  tombstones.delete(voiceNoteId);
  writeVTombstones(userId, tombstones);
}

function isVoiceScopeActive(userId: string): boolean {
  try {
    return getStoreScopeKey() === `${STORE_KEY_PREFIX}:${userId}`;
  } catch {
    return false;
  }
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? false : navigator.onLine;
}

export interface ServerVoiceNoteRow {
  id: string;
  userId: string;
  noteId: string | null;
  audioUrl: string;
  duration: number;
  transcript: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VoiceNotesResponse {
  success?: boolean;
  voiceNotes?: ServerVoiceNoteRow[];
  error?: string;
}

interface VoiceNoteSaveResponse {
  success?: boolean;
  voiceNote?: ServerVoiceNoteRow;
  error?: string;
}

type TokenFn = () => Promise<string | null>;

// Prevents duplicate hydration under React StrictMode: module-level in-flight
// set keyed by clerk user id (voice sync runs independently from note sync).
const voiceSyncInFlight = new Set<string>();

// Per-note DELETE serialization. DELETEs for the same note are chained so a
// compensating DELETE issued after a stale upload always runs after any
// in-flight DELETE, and the tombstone is removed only by the last confirmed
// success while the store is still scoped to its user.
const voiceDeleteChains = new Map<string, Promise<boolean>>();
const voiceQueuedDeletes = new Map<string, number>();

function deleteKey(userId: string, voiceNoteId: string): string {
  return `${userId}:${voiceNoteId}`;
}

function attemptVoiceDelete(userId: string, voiceNoteId: string, token: string): Promise<void> {
  const key = deleteKey(userId, voiceNoteId);
  voiceQueuedDeletes.set(key, (voiceQueuedDeletes.get(key) ?? 0) + 1);
  const previous = voiceDeleteChains.get(key) ?? Promise.resolve();
  const run = previous.then(() => performVoiceDelete(userId, voiceNoteId, token));
  // Swallow run failures so a network error never blocks the chain or leaks.
  voiceDeleteChains.set(key, run.then(() => true, () => true));
  return run.then(() => undefined);
}

async function performVoiceDelete(userId: string, voiceNoteId: string, token: string): Promise<boolean> {
  const key = deleteKey(userId, voiceNoteId);
  let success = false;
  try {
    const res = await apiFetch<{ success?: boolean }>(`${API.voiceNotes}?id=${encodeURIComponent(voiceNoteId)}`, {
      method: 'DELETE',
      token,
    });
    success = !!res && res.success === true;
  } catch {
    // non-destructive: keep the tombstone so a later sync retries
  } finally {
    const remaining = (voiceQueuedDeletes.get(key) ?? 1) - 1;
    if (remaining <= 0) voiceQueuedDeletes.delete(key);
    else voiceQueuedDeletes.set(key, remaining);
    // Only a confirmed success while still scoped to this user clears the
    // tombstone — and only when this is the last queued DELETE.
    if (success && isVoiceScopeActive(userId) && remaining === 0) {
      removeVTombstone(userId, voiceNoteId);
    }
  }
  return success;
}

/** Retries the remote DELETE for every tombstoned voice note of the given user. */
async function flushPendingVoiceDeletes(userId: string, getToken: TokenFn): Promise<void> {
  if (typeof window === 'undefined' || !isOnline()) return;
  const tombstones = readVTombstones(userId);
  if (tombstones.size === 0) return;
  let token: string | null = null;
  try {
    token = await getToken();
  } catch {
    return; // keep tombstones; retried on a later sync
  }
  if (!token || !isVoiceScopeActive(userId)) return;
  for (const voiceNoteId of tombstones) {
    if (!isOnline() || !isVoiceScopeActive(userId)) return;
    await attemptVoiceDelete(userId, voiceNoteId, token);
  }
}

/**
 * Multipart upload of ONE pending voice note's local blob. The upload is
 * local-first: the store row already exists (persisted via IndexedDB + Zustand)
 * before this runs, so a failure never loses the recording — it stays pending
 * and retries on the next sync. On confirmed success the row is marked `synced`
 * with the server `audioUrl` and `updatedAt`, while the IndexedDB `audioId` is
 * deliberately kept as the preferred playback source.
 */
async function performVoiceUpload(voiceNote: VoiceNote, userId: string, token: string): Promise<void> {
  // A row the server already holds does not need re-uploading.
  if (voiceNote.synced && voiceNote.audioUrl) return;
  if (!voiceNote.audioId) return;
  if (!isOnline()) return;
  // A note deleted locally must never be (re)created remotely.
  if (readVTombstones(userId).has(voiceNote.id)) return;

  const blob = await getVoiceAudioBlob(voiceNote.audioId);
  if (!blob) return; // durable bytes are gone — cannot upload; stays pending

  const formData = new FormData();
  formData.append('file', blob);
  formData.append('id', voiceNote.id);
  formData.append('noteId', voiceNote.noteId ?? '');
  formData.append('duration', String(voiceNote.duration));
  if (voiceNote.transcript) formData.append('transcript', voiceNote.transcript);

  const res = await apiFetchMultipart<VoiceNoteSaveResponse>(API.voiceNotes, formData, { token });
  if (!res || res.success !== true || !res.voiceNote) return;

  // The account switched while the upload was in flight: never write the
  // confirmation into the new account's store.
  if (!isVoiceScopeActive(userId)) return;

  // A delete landed while the upload was in flight: the server may hold the
  // recreated row, so never mark it synced — compensate with a remote DELETE.
  if (readVTombstones(userId).has(voiceNote.id)) {
    await attemptVoiceDelete(userId, voiceNote.id, token);
    return;
  }

  const server = res.voiceNote;
  useStore.setState((s) => ({
    voiceNotes: s.voiceNotes.map((vn) =>
      vn.id === voiceNote.id
        ? { ...vn, synced: true, audioUrl: server.audioUrl, updatedAt: server.updatedAt }
        : vn
    ),
  }));
}

/**
 * Fire-and-forget upload for a just-saved local voice note. Call RIGHT AFTER
 * `addVoiceNote`/IndexedDB save. Guest scope, offline state and already-synced
 * rows all no-op; failures leave the row pending for a later retry.
 */
export async function uploadVoiceNote(voiceNote: VoiceNote, getToken: TokenFn): Promise<void> {
  if (typeof window === 'undefined' || !isOnline()) return;
  const scope = getStoreScopeKey();
  const userId = getScopeUserId(scope);
  if (!userId) return; // guest scope → no sync

  let token: string | null = null;
  try {
    token = await getToken();
  } catch {
    return;
  }
  if (!token || getStoreScopeKey() !== scope) return;
  await performVoiceUpload(voiceNote, userId, token);
}

/**
 * Fire-and-forget remote delete. The local delete already happened (metadata
 * removed + IndexedDB blob cleaned in the component), so a network failure must
 * never restore the voice note remotely: the tombstone is recorded FIRST and
 * only removed once a remote DELETE is confirmed successful.
 */
export async function deleteRemoteVoiceNote(voiceNoteId: string, getToken: TokenFn): Promise<void> {
  if (typeof window === 'undefined') return;
  const scope = getStoreScopeKey();
  const userId = getScopeUserId(scope);
  if (!userId) return; // guest scope → no sync

  addVTombstone(userId, voiceNoteId);
  if (!isOnline()) return; // tombstone persists; retried on reconnect

  try {
    const token = await getToken();
    if (!token || getStoreScopeKey() !== scope) return;
    await attemptVoiceDelete(userId, voiceNoteId, token);
  } catch {
    // tombstone stays for a later retry
  }
}

/** Server row → local VoiceNote. Derived audio (Cloudinary URL) plays directly;
 *  there is no IndexedDB blob on this device, so audioId stays null. */
function toLocalVoiceNote(server: ServerVoiceNoteRow): VoiceNote {
  return {
    id: server.id,
    noteId: server.noteId ?? null,
    audioId: null,
    audioUrl: server.audioUrl,
    synced: true,
    updatedAt: server.updatedAt,
    duration: typeof server.duration === 'number' ? server.duration : 0,
    transcript: server.transcript ?? null,
    createdAt: server.createdAt,
  };
}

/** Newest updatedAt wins; on equal timestamps the server version wins. */
function serverWins(local: VoiceNote, server: ServerVoiceNoteRow): boolean {
  const localTime = timeValue(local.updatedAt);
  const serverTime = timeValue(server.updatedAt);
  if (Number.isNaN(localTime) || Number.isNaN(serverTime)) return false;
  return serverTime >= localTime;
}

/** ISO timestamp → epoch millis; NaN for absent/invalid values. */
function timeValue(at: string | undefined | null): number {
  if (!at) return Number.NaN;
  return new Date(at).getTime();
}

/** Per-ID LWW merge that never wipes local data, uploads pending local notes,
 *  and adopts server-only notes (multi-device). */
async function mergeServerVoiceNotes(
  serverRows: ServerVoiceNoteRow[],
  userId: string,
  token: string
): Promise<void> {
  const tombstones = readVTombstones(userId);
  const localNotes = useStore.getState().voiceNotes.filter((vn) => !tombstones.has(vn.id));
  const serverNotes = serverRows.filter((vn) => !tombstones.has(vn.id));

  const serverMap = new Map(serverNotes.map((n) => [n.id, n]));
  const merged: VoiceNote[] = [];
  const seen = new Set<string>();
  const toUpload: VoiceNote[] = [];

  for (const local of localNotes) {
    seen.add(local.id);
    const server = serverMap.get(local.id);
    if (!server) {
      // Local-only: keep it, and upload it if its audio is still pending.
      merged.push(local);
      if (!local.synced && local.audioId) toUpload.push(local);
      continue;
    }
    if (serverWins(local, server)) {
      // Server holds the newest copy (or the tie): adopt its confirmed URL,
      // transcript and clock while preserving the local IndexedDB blob handle.
      merged.push({
        ...local,
        noteId: server.noteId ?? null,
        audioUrl: server.audioUrl,
        duration: server.duration,
        transcript: server.transcript ?? null,
        synced: true,
        updatedAt: server.updatedAt,
        createdAt: server.createdAt,
      });
      continue;
    }
    // Local is strictly newer: keep it and re-push its pending audio.
    merged.push(local);
    if (!local.synced && local.audioId) toUpload.push(local);
  }

  for (const server of serverNotes) {
    if (!seen.has(server.id)) merged.push(toLocalVoiceNote(server));
  }

  for (const note of toUpload) {
    if (!isVoiceScopeActive(userId)) return;
    await performVoiceUpload(note, userId, token);
  }

  if (!isVoiceScopeActive(userId)) return;
  // The commit is a functional update that re-reads the CURRENT store, so a
  // note created or edited while the merge awaited uploads is never dropped or
  // rolled back, and a note deleted while it was in flight is never re-adopted.
  const tombstonesAtCommit = readVTombstones(userId);
  const localSnapshotIds = new Set(localNotes.map((vn) => vn.id));
  useStore.setState((s) => {
    const currentById = new Map(s.voiceNotes.map((n) => [n.id, n]));
    const commitSeen = new Set<string>();
    const next: VoiceNote[] = [];
    for (const cand of merged) {
      if (tombstonesAtCommit.has(cand.id)) continue;
      const cur = currentById.get(cand.id);
      // Locally-deleted mid-merge: a candidate that WAS local at snapshot time
      // but is now absent was deleted by the user — never re-adopt it.
      if (!cur && localSnapshotIds.has(cand.id)) continue;
      if (!cur) {
        commitSeen.add(cand.id);
        next.push(cand);
        continue;
      }
      commitSeen.add(cand.id);
      if (timeValue(cur.updatedAt) > timeValue(cand.updatedAt)) {
        next.push(cur);
      } else {
        next.push(cand);
      }
    }
    // Keep notes created while the merge was in flight (never drop, never add a
    // duplicate id).
    for (const cur of s.voiceNotes) {
      if (!commitSeen.has(cur.id) && !tombstonesAtCommit.has(cur.id)) next.push(cur);
    }
    return { voiceNotes: next };
  });
}

/**
 * Collects every audioId referenced by the persisted metadata of ANY store
 * scope (guest + every per-user key). The orphan sweep keeps all of these so it
 * can never delete another account's audio: only blobs referenced by NO store —
 * genuinely orphaned bytes — are removed.
 */
function collectReferencedAudioIds(): string[] {
  const ids: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(STORE_KEY_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const envelope = parsed as { state?: unknown };
        const state = envelope && typeof envelope.state === 'object' && envelope.state ? envelope.state : parsed;
        const voiceNotes = (state as { voiceNotes?: Array<{ audioId?: unknown }> }).voiceNotes;
        if (Array.isArray(voiceNotes)) {
          for (const vn of voiceNotes) {
            if (vn && typeof vn.audioId === 'string') ids.push(vn.audioId);
          }
        }
      }
    }
  } catch {
    // best-effort — an unreadable store must never break the sweep contract
  }
  return ids;
}

/**
 * Safe orphan sweep: purges every IndexedDB blob that NO store account
 * references. Keeps the current store's live audioIds AND every audioId found
 * in any persisted store metadata, so account A signing in can never delete
 * account B's (or the guest scope's) audio. Best-effort and never throws.
 */
export async function sweepOrphanedVoiceAudio(): Promise<number> {
  const current = useStore
    .getState()
    .voiceNotes.map((vn) => vn.audioId)
    .filter((id): id is string => !!id);
  const keep = new Set([...current, ...collectReferencedAudioIds()]);
  try {
    return await purgeOrphanedVoiceAudio([...keep]);
  } catch {
    return 0;
  }
}

/**
 * Full voice-note hydration for a signed-in user. Runs independently from note
 * sync (see app/page.tsx). Call AFTER switchStoreScopeForUser(clerkUserId) so
 * the store is already scoped to the user. Any async step re-checks that the
 * store is still scoped to this user before touching Zustand.
 */
export async function syncVoiceNotesForUser(clerkUserId: string, getToken: TokenFn): Promise<void> {
  if (!clerkUserId || typeof window === 'undefined' || !isOnline()) return;
  if (voiceSyncInFlight.has(clerkUserId)) return;
  voiceSyncInFlight.add(clerkUserId);
  const syncUserId = clerkUserId;
  try {
    const token = await getToken();
    if (!token || !isVoiceScopeActive(syncUserId)) return;

    // Retry any previously-failed remote DELETEs BEFORE server rows can be
    // adopted, so a tombstoned voice note cannot be read back into local state.
    await flushPendingVoiceDeletes(syncUserId, getToken);
    if (!isOnline() || !isVoiceScopeActive(syncUserId)) return;

    const res = await apiFetch<VoiceNotesResponse>(API.voiceNotes, { token });
    if (!res || res.success !== true || !Array.isArray(res.voiceNotes)) return;
    if (!isVoiceScopeActive(syncUserId)) return;

    await mergeServerVoiceNotes(res.voiceNotes, syncUserId, token);

    // Post-hydration safe orphan sweep (best-effort).
    if (isVoiceScopeActive(syncUserId)) {
      void sweepOrphanedVoiceAudio().catch(() => {
        // never fail hydration because of a storage sweep
      });
    }
  } catch {
    // Non-destructive: never clear/overwrite local voice notes on failure.
  } finally {
    voiceSyncInFlight.delete(clerkUserId);
  }
}