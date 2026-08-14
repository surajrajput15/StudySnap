import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  switchStoreScopeForUser,
  migrateGuestDataForUser,
  useStore,
} from '../lib/store/useStore.ts';

// Day 13 Task 1 — the primary user journey, end to end, at the logic layer:
// guest study session (note + voice memo) → spaced revision scheduling →
// sign-in migration into the account → edit → delete. This is the flow the
// whole app is built around, so the store must never lose data across it.

function makeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as Storage;
}

interface TestGlobal {
  window: { localStorage: Storage; dispatchEvent: () => boolean };
}

const g = globalThis as unknown as TestGlobal;

// A fresh scope per test: switchStoreScopeForUser early-returns for the same id,
// so a shared id would carry progress/streak state across tests in this file.
let seq = 0;

beforeEach(() => {
  g.window = {
    localStorage: makeLocalStorage(),
    dispatchEvent: () => true,
  };
  switchStoreScopeForUser(`test-user-${++seq}`);
});

function makeNote(title: string) {
  return {
    title,
    content: 'content',
    tags: [] as string[],
    isPinned: false,
    isFavorite: false,
    pinLock: null,
    categoryId: null,
    folderId: null,
    lastRevisedAt: null,
    nextRevisionAt: null,
    revisionStreak: 0,
  };
}

function makeVoiceNote() {
  return {
    noteId: null,
    audioId: 'audio-1',
    audioUrl: null,
    synced: false,
    updatedAt: new Date().toISOString(),
    duration: 1,
    transcript: 'transcript',
  };
}

test('a study session survives the guest → account journey', () => {
  // 1. Guest studies: creates a note and records a voice memo.
  switchStoreScopeForUser(null);
  const guest = useStore.getState();
  const note = guest.addNote(makeNote('Chem'));
  guest.addVoiceNote(makeVoiceNote());
  assert.equal(useStore.getState().user.streakCount, 1, 'guest study activity earns a streak');
  assert.equal(useStore.getState().dailyProgress, 2, 'note + memo = 2 towards the daily goal');

  // 2. Revising a note schedules the next session and grows the streak.
  guest.markAsRevised(note.id, 'easy');
  const revised = useStore.getState().notes.find((n) => n.id === note.id)!;
  assert.equal(revised.revisionStreak, 1);
  assert.ok(revised.nextRevisionAt, 'a next revision is scheduled');
  const gapDays = (new Date(revised.nextRevisionAt).getTime() - Date.now()) / 86_400_000;
  assert.ok(gapDays >= 6.9 && gapDays <= 7.1, `easy → 7-day schedule (got ${gapDays.toFixed(2)})`);
  assert.equal(useStore.getState().revisionLogs.length, 1);

  // 3. Sign-in: the guest data folds into the fresh account scope.
  switchStoreScopeForUser('user-123');
  const migrated = migrateGuestDataForUser('user-123');
  assert.ok(migrated, 'a migration summary is returned');
  assert.ok((migrated?.notes ?? 0) >= 1, 'notes moved');
  assert.ok((migrated?.voiceNotes ?? 0) >= 1, 'voice memos moved');
  const account = useStore.getState();
  assert.equal(account.notes.some((n) => n.id === note.id), true, 'the note lives in the account');
  assert.equal(account.voiceNotes.length, 1, 'the memo lives in the account');
  // Day 9 Task 13 — the fresh account must not inherit the guest streak.
  assert.equal(account.user.streakCount, 0, 'a fresh account stays streak-honest');

  // 4. The user edits the note in the account.
  account.updateNote(note.id, { title: 'Chemistry Final', isFavorite: true });
  const edited = useStore.getState().notes.find((n) => n.id === note.id)!;
  assert.equal(edited.title, 'Chemistry Final');
  assert.equal(edited.isFavorite, true);

  // 5. The user deletes the note.
  useStore.getState().deleteNote(note.id);
  assert.equal(useStore.getState().notes.some((n) => n.id === note.id), false);
});

test('migrateGuestDataForUser is a no-op when the guest scope is already empty', () => {
  switchStoreScopeForUser(null);
  switchStoreScopeForUser('user-456');
  assert.equal(migrateGuestDataForUser('user-456'), null);
});