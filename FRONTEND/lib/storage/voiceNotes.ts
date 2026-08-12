/**
 * Day 6 — Browser-local durable storage for voice memo audio.
 *
 * Voice memo audio is stored as raw Blobs in IndexedDB so it survives page
 * reloads and tab restarts. Only a stable `audioId` string is kept in the
 * per-user Zustand metadata (localStorage); the actual bytes never touch
 * localStorage or Zustand.
 *
 * The store is intentionally tiny: save / get / delete plus an optional
 * orphan sweep. Blob retrieval failures return null rather than throwing so
 * playback can fail gracefully.
 */

const DB_NAME = 'studysnap:voice-audio';
const STORE_NAME = 'audio';

export interface VoiceAudioRecord {
  id: string;
  blob: Blob;
  createdAt: string;
}

let db: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      db = request.result;
      db.onversionchange = () => {
        if (db) {
          db.close();
          db = null;
          dbPromise = null;
        }
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to open voice audio database.'));
    request.onblocked = () => reject(new Error('Voice audio database open was blocked.'));
  });
  return dbPromise;
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function runTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}

/** Persists an audio Blob under a stable id. */
export async function saveVoiceAudio(audioId: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  const tx = database.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const record: VoiceAudioRecord = {
    id: audioId,
    blob,
    createdAt: new Date().toISOString(),
  };
  store.put(record);
  await runTransaction(tx);
}

/** Resolves an audio Blob by id, or null when missing/unreadable. */
export async function getVoiceAudio(audioId: string): Promise<Blob | null> {
  try {
    const database = await openDatabase();
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const record = await runRequest(store.get(audioId)) as VoiceAudioRecord | undefined;
    return record?.blob ?? null;
  } catch {
    // Playback must fail gracefully — never crash the VoiceNotes UI.
    return null;
  }
}

/**
 * Upload-source alias of getVoiceAudio: resolves the raw Blob backing an
 * `audioId` so the sync layer can build the multipart upload payload. Returns
 * null (never throws) when the blob is missing or unreadable — a note whose
 * durable bytes are gone cannot be uploaded and must simply stay pending.
 */
export async function getVoiceAudioBlob(audioId: string): Promise<Blob | null> {
  return getVoiceAudio(audioId);
}

/** Removes an audio Blob by id (idempotent). */
export async function deleteVoiceAudio(audioId: string): Promise<void> {
  const database = await openDatabase();
  const tx = database.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(audioId);
  await runTransaction(tx);
}

/**
 * Deletes every stored Blob whose id is not in `idsToKeep`.
 * Returns the number of records removed. Using a single readwrite
 * transaction keeps the sweep atomic.
 */
export async function purgeOrphanedVoiceAudio(idsToKeep: readonly string[]): Promise<number> {
  const keep = new Set(idsToKeep);
  const database = await openDatabase();
  const tx = database.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  let removed = 0;

  await new Promise<void>((resolve, reject) => {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const record = cursor.value as VoiceAudioRecord;
        if (!keep.has(record.id)) {
          cursor.delete();
          removed += 1;
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to sweep voice audio.'));
  });

  await runTransaction(tx);
  return removed;
}

/**
 * Closes the cached connection and forgets it, forcing the next operation to
 * open a fresh database connection. Primarily used by tests to simulate a
 * reload / new module instance; also safe to call at any time.
 */
export async function resetVoiceAudioStore(): Promise<void> {
  if (db) {
    db.close();
    db = null;
  }
  dbPromise = null;
}

/** True while a recording still belongs to the store scope it was started in. */
export function isVoiceRecordingScopeValid(
  recordedScopeKey: string | null,
  currentScopeKey: string | null,
): boolean {
  return !!recordedScopeKey && recordedScopeKey === currentScopeKey;
}

/**
 * Final transcript for a persisted voice note. Returns null only when there is
 * genuinely no transcript, so the placeholder is never chosen over real text.
 */
export function finalizeVoiceNoteTranscript(accumulated: string | null | undefined): string | null {
  const trimmed = (accumulated ?? '').trim();
  return trimmed || null;
}