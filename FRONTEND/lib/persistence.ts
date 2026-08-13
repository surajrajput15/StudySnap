/**
 * Day 9 Task 10 — mobile-safe storage persistence.
 *
 * The local-first store lives entirely in the browser (IndexedDB + localStorage,
 * plus the voice-audio blobs). Mobile browsers evict such storage when under
 * pressure, silently wiping a user's notes and recordings. This asks the browser
 * to grant the origin persistent storage (Chrome/Edge/Firefox/Safari 15.4+),
 * which prevents eviction and is the recommended PWA survival practice.
 *
 * Idempotent and safe to call on every app mount: once the browser grants
 * persistence, `persisted()` resolves true and `persist()` short-circuits. The
 * helper is also injectable so it is unit-testable without a real navigator.
 */

export type StoragePersistenceState = 'unsupported' | 'granted' | 'denied';

export interface StoragePersistenceResult {
  state: StoragePersistenceState;
  /** True when storage is (or just became) persistent. */
  persisted: boolean;
}

interface PersistentStorageLike {
  persist: () => Promise<boolean>;
  persisted: () => Promise<boolean>;
}

function browserStorage(): PersistentStorageLike | null {
  if (typeof navigator === 'undefined' || !navigator.storage) return null;
  const storage = navigator.storage as PersistentStorageLike;
  if (typeof storage.persist !== 'function' || typeof storage.persisted !== 'function') return null;
  return storage;
}

export async function requestPersistentStorage(opts?: {
  storage?: PersistentStorageLike;
}): Promise<StoragePersistenceResult> {
  const storage = opts?.storage ?? browserStorage();
  if (!storage) {
    return { state: 'unsupported', persisted: false };
  }
  try {
    if (await storage.persisted()) {
      return { state: 'granted', persisted: true };
    }
    const granted = await storage.persist();
    return { state: granted ? 'granted' : 'denied', persisted: granted };
  } catch {
    return { state: 'denied', persisted: false };
  }
}