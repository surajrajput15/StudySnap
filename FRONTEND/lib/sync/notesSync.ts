import { useStore, getStoreScopeKey, type Note } from '@/lib/store/useStore';
import { API, apiFetch } from '@/lib/config';

/**
 * Day 5 — Notes sync layer (Phase 2).
 *
 * Responsibilities (NOTES ONLY):
 *  - One-time seed of local notes when the server store is empty.
 *  - Per-ID newest-updatedAt-wins merge between local and server notes.
 *  - Durability for local-only notes via safe upsert-by-id POSTs.
 *  - Fire-and-forget remote upsert (editor autosave) and remote DELETE.
 *
 * Deliberately out of scope this phase:
 *  - voice notes, revision, gamification, folders/categories sync
 *  - offline mutation queues / conflict-resolution engines
 *  - sending pinLock, categoryId, folderId to the server
 */

const SYNC_FLAG_PREFIX = 'studysnap:notes-synced';
const STORE_KEY_PREFIX = 'studysnap-store';
const TOMBSTONE_PREFIX = 'studysnap:tombstones';

/**
 * Day 6 — User-scoped delete tombstones.
 *
 * A note deleted locally while offline, or while the backend DELETE failed, must
 * never resurrect on the next hydration/merge. The tombstone is recorded in
 * localStorage immediately at delete time and only removed once a remote DELETE
 * is confirmed successful. Because the key is scoped to the Clerk user id,
 * Account A's tombstones can never leak into Account B (or the guest scope).
 */

function getTombstoneKey(userId: string): string {
  return `${TOMBSTONE_PREFIX}:${userId}`;
}

/** Reads the current user's deleted note ids. Never throws — a corrupt or
 *  unavailable localStorage simply yields an empty set so sync still works. */
function readTombstones(userId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(getTombstoneKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

/** Persists the tombstone set. Best-effort: a storage failure must never throw. */
function writeTombstones(userId: string, tombstones: Set<string>): void {
  try {
    window.localStorage.setItem(getTombstoneKey(userId), JSON.stringify([...tombstones]));
  } catch {
    // ignore — tombstones are best-effort durability
  }
}

function addTombstone(userId: string, noteId: string): void {
  const tombstones = readTombstones(userId);
  tombstones.add(noteId);
  writeTombstones(userId, tombstones);
}

function removeTombstone(userId: string, noteId: string): void {
  const tombstones = readTombstones(userId);
  if (!tombstones.has(noteId)) return;
  tombstones.delete(noteId);
  writeTombstones(userId, tombstones);
}

/** Extracts the Clerk user id from an active store scope key, or null when the
 *  scope is the guest/anonymous store. */
function getActiveUserId(scope: string): string | null {
  const prefix = `${STORE_KEY_PREFIX}:`;
  if (!scope.startsWith(prefix)) return null;
  const userId = scope.slice(prefix.length);
  return userId || null;
}

export interface ServerNoteRow {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  categoryId: string | null;
  folderId: string | null;
  lastRevisedAt: string | null;
  nextRevisionAt: string | null;
  revisionStreak: number;
  createdAt: string;
  updatedAt: string;
}

interface NotesResponse {
  success?: boolean;
  notes?: ServerNoteRow[];
  error?: string;
}

interface NoteSaveResponse {
  success?: boolean;
  note?: ServerNoteRow;
  error?: string;
}

type TokenFn = () => Promise<string | null>;

// Prevents duplicate hydration under React StrictMode: module-level in-flight
// set keyed by clerk user id, alongside the persisted per-user completed flag.
const inFlight = new Set<string>();

// Prevents duplicate concurrent DELETE requests for the same note (keyed by
// `${userId}:${noteId}`) coming from the delete flow and the sync retry flow.
const deleteInFlight = new Set<string>();

function getSyncFlag(userId: string): boolean {
  try {
    return window.localStorage.getItem(`${SYNC_FLAG_PREFIX}:${userId}`) === '1';
  } catch {
    return false;
  }
}

function setSyncFlag(userId: string): void {
  try {
    window.localStorage.setItem(`${SYNC_FLAG_PREFIX}:${userId}`, '1');
  } catch {
    // ignore storage failures — sync can retry later
  }
}

/** True while the store is still scoped to the given Clerk user. */
function isUserScopeActive(userId: string): boolean {
  try {
    return getStoreScopeKey() === `${STORE_KEY_PREFIX}:${userId}`;
  } catch {
    return false;
  }
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? false : navigator.onLine;
}

function deserializeTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Server row → local Note. Server notes carry no pinLock, and this phase
 *  intentionally leaves categoryId/folderId null (server categories/folders
 *  are not modeled client-side yet). */
function toLocalNote(server: ServerNoteRow): Note {
  return {
    id: server.id,
    title: server.title,
    content: server.content,
    tags: deserializeTags(server.tags),
    isPinned: !!server.isPinned,
    isFavorite: !!server.isFavorite,
    pinLock: null,
    categoryId: null,
    folderId: null,
    lastRevisedAt: server.lastRevisedAt ?? null,
    nextRevisionAt: server.nextRevisionAt ?? null,
    revisionStreak: typeof server.revisionStreak === 'number' ? server.revisionStreak : 0,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
  };
}

export interface RemoteNotePayload {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  isFavorite: boolean;
  categoryId: null;
  folderId: null;
  createdAt: string;
}

/** Local Note → safe server payload. pinLock, userId and local-only
 *  categoryId/folderId are intentionally omitted. */
export function toRemotePayload(note: Note): RemoteNotePayload {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    tags: note.tags,
    isPinned: note.isPinned,
    isFavorite: note.isFavorite,
    categoryId: null,
    folderId: null,
    createdAt: note.createdAt,
  };
}

/** Newest updatedAt wins; on equal timestamps the server version wins. Local
 *  PIN/category/folder values always remain local-owned. */
function pickWinner(local: Note, server: ServerNoteRow): Note {
  const localTime = new Date(local.updatedAt).getTime();
  const serverTime = new Date(server.updatedAt).getTime();
  const serverWins = !Number.isNaN(serverTime) && serverTime >= localTime;
  if (!serverWins) return local;
  return {
    ...toLocalNote(server),
    pinLock: local.pinLock,
    categoryId: local.categoryId,
    folderId: local.folderId,
  };
}

async function postNote(payload: RemoteNotePayload, token: string): Promise<ServerNoteRow | null> {
  const res = await apiFetch<NoteSaveResponse>(API.notes, {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });
  if (!res || res.success !== true || !res.note) return null;
  return res.note;
}

/** Issues a single remote DELETE for a tombstoned note, removing the tombstone
 *  ONLY on a confirmed server success while the store is still scoped to the
 *  user. Dedupes concurrent DELETEs for the same note. Never throws. */
async function attemptRemoteDelete(userId: string, noteId: string, token: string): Promise<void> {
  const key = `${userId}:${noteId}`;
  if (deleteInFlight.has(key)) return; // a DELETE is already underway
  deleteInFlight.add(key);
  try {
    const res = await apiFetch<{ success?: boolean }>(`${API.notes}?id=${encodeURIComponent(noteId)}`, {
      method: 'DELETE',
      token,
    });
    // Only a confirmed success while still scoped to this user clears the
    // tombstone; a mid-flight account switch can never remove another
    // account's tombstone.
    if (res && res.success === true && isUserScopeActive(userId)) {
      removeTombstone(userId, noteId);
    }
  } catch {
    // non-destructive: keep the tombstone so a later sync retries
  } finally {
    deleteInFlight.delete(key);
  }
}

/** Retries the remote DELETE for every tombstoned note of the given user.
 *  Tombstones are removed only after each DELETE is confirmed successful;
 *  failures keep the tombstone for a future retry without wiping anything. */
async function flushPendingDeletes(userId: string, getToken: TokenFn): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isOnline()) return;
  const tombstones = readTombstones(userId);
  if (tombstones.size === 0) return;
  let token: string | null = null;
  try {
    token = await getToken();
  } catch {
    return; // keep tombstones; retried on a later sync
  }
  if (!token || !isUserScopeActive(userId)) return;
  for (const noteId of tombstones) {
    if (!isOnline() || !isUserScopeActive(userId)) return;
    await attemptRemoteDelete(userId, noteId, token);
  }
}

/** Seeds every local note onto an empty server store. Returns true only when
 *  ALL uploads succeed; otherwise leaves the sync flag unset for retry. */
async function seedLocalNotes(localNotes: Note[], userId: string, token: string): Promise<boolean> {
  for (const note of localNotes) {
    if (!isUserScopeActive(userId)) return false;
    const server = await postNote(toRemotePayload(note), token);
    if (!server) return false;
  }
  return true;
}

/** Per-ID merge that never wipes local data, then makes local-only notes
 *  durable with safe upsert-by-id POSTs. */
async function mergeServerNotes(
  localNotes: Note[],
  serverNotes: ServerNoteRow[],
  userId: string,
  token: string
): Promise<void> {
  // Filter every source by the current user's tombstones so a note deleted
  // locally (and not yet confirmed deleted server-side) can neither be adopted
  // back into state nor re-seeded. Fresh UUIDs are never tombstoned.
  const tombstones = readTombstones(userId);
  const localNotesToMerge = localNotes.filter((n) => !tombstones.has(n.id));
  const serverNotesToMerge = serverNotes.filter((n) => !tombstones.has(n.id));

  const serverMap = new Map(serverNotesToMerge.map((n) => [n.id, n]));
  const merged: Note[] = [];
  const seen = new Set<string>();
  const localOnly: Note[] = [];

  for (const local of localNotesToMerge) {
    seen.add(local.id);
    const server = serverMap.get(local.id);
    if (!server) {
      localOnly.push(local);
      merged.push(local);
    } else {
      merged.push(pickWinner(local, server));
    }
  }

  for (const server of serverNotesToMerge) {
    if (!seen.has(server.id)) {
      merged.push(toLocalNote(server));
    }
  }

  for (const note of localOnly) {
    if (!isUserScopeActive(userId)) return;
    const server = await postNote(toRemotePayload(note), token);
    if (!server) continue; // non-destructive: keep the local note for a later retry
    const idx = merged.findIndex((n) => n.id === note.id);
    if (idx !== -1 && server.updatedAt) {
      const serverTime = new Date(server.updatedAt).getTime();
      const localTime = new Date(merged[idx].updatedAt).getTime();
      // Adopt the server clock only when it is not older than the local note,
      // so an in-flight newer local save is never rolled back invisibly.
      if (Number.isNaN(localTime) || serverTime >= localTime) {
        merged[idx] = { ...merged[idx], updatedAt: server.updatedAt };
      }
    }
  }

  if (!isUserScopeActive(userId)) return;
  useStore.setState({ notes: merged });
}

/**
 * Full notes hydration for a signed-in user.
 *
 * Call AFTER switchStoreScopeForUser(clerkUserId) so the store is already
 * scoped to the user. Any async step re-checks that the store is still scoped
 * to this user before touching Zustand, so a switched account can never
 * receive another account's server notes.
 */
export async function syncNotesForUser(clerkUserId: string, getToken: TokenFn): Promise<void> {
  if (!clerkUserId) return;
  if (typeof window === 'undefined') return;
  if (!isOnline()) return;
  if (inFlight.has(clerkUserId)) return;
  inFlight.add(clerkUserId);
  const syncUserId = clerkUserId;
  try {
    const token = await getToken();
    if (!token || !isUserScopeActive(syncUserId)) return;

    // Retry any previously-failed remote DELETEs BEFORE server rows can be
    // adopted, so a tombstoned note cannot be read back into local state.
    await flushPendingDeletes(syncUserId, getToken);
    if (!isOnline() || !isUserScopeActive(syncUserId)) return;

    const res = await apiFetch<NotesResponse>(API.notes, { token });
    if (!res || res.success !== true || !Array.isArray(res.notes)) return;
    if (!isUserScopeActive(syncUserId)) return;

    const serverNotes = res.notes;
    const localNotes = useStore.getState().notes;

    // One-time seed: empty server + existing local notes + flag not set yet.
    if (serverNotes.length === 0 && localNotes.length > 0 && !getSyncFlag(syncUserId)) {
      // Never seed a note that was locally deleted — its tombstone keeps it out.
      const tombstones = readTombstones(syncUserId);
      const seedable = localNotes.filter((n) => !tombstones.has(n.id));
      if (seedable.length === 0) return;
      const seeded = await seedLocalNotes(seedable, syncUserId, token);
      if (seeded) setSyncFlag(syncUserId);
      return;
    }

    await mergeServerNotes(localNotes, serverNotes, syncUserId, token);
  } catch {
    // Non-destructive: never clear/overwrite local notes on failure.
  } finally {
    inFlight.delete(clerkUserId);
  }
}

/**
 * Fire-and-forget remote upsert used by the editor's local-first autosave.
 * Never blocks local saving and never clears local data on failure.
 */
export async function upsertRemoteNote(note: Note, getToken: TokenFn): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isOnline()) return;
  const scope = getStoreScopeKey();
  if (!scope || scope === STORE_KEY_PREFIX) return; // guest scope → no sync
  try {
    const token = await getToken();
    if (!token || getStoreScopeKey() !== scope) return;
    const server = await postNote(toRemotePayload(note), token);
    if (!server || !server.updatedAt || getStoreScopeKey() !== scope) return;
    const serverUpdatedAt = server.updatedAt;
    useStore.setState((s) => ({
      notes: s.notes.map((n) => {
        if (n.id !== note.id) return n;
        // Adopt the server clock only when it isn't older than the local note,
        // so an overlapping local save is never rolled back invisibly.
        const localTime = new Date(n.updatedAt).getTime();
        const serverTime = new Date(serverUpdatedAt).getTime();
        const geq = Number.isNaN(serverTime) || Number.isNaN(localTime) || serverTime >= localTime;
        return geq ? { ...n, updatedAt: serverUpdatedAt } : n;
      }),
    }));
  } catch {
    // local data already committed — ignore
  }
}

/** Fire-and-forget remote delete. The local delete already happened, so a
 *  network failure must never restore the note. The tombstone is recorded
 *  FIRST (local-first) and only removed once the remote DELETE is confirmed
 *  successful; a failed or offline DELETE keeps it so a later sync retries. */
export async function deleteRemoteNote(noteId: string, getToken: TokenFn): Promise<void> {
  if (typeof window === 'undefined') return;
  const scope = getStoreScopeKey();
  if (!scope || scope === STORE_KEY_PREFIX) return; // guest scope → no sync
  const userId = getActiveUserId(scope);
  if (!userId) return;

  // Record the tombstone immediately so a failed/offline DELETE cannot let the
  // server resurrect the deleted note on the next hydration/merge.
  addTombstone(userId, noteId);

  if (!isOnline()) return; // tombstone persists; retried on reconnect
  try {
    const token = await getToken();
    if (!token || getStoreScopeKey() !== scope) return;
    await attemptRemoteDelete(userId, noteId, token);
  } catch {
    // tombstone stays for a later retry
  }
}
