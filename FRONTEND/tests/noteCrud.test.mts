import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { switchStoreScopeForUser, useStore } from '../lib/store/useStore.ts';

// Day 13 Task 3 — Note CRUD at the store level: id/timestamp generation,
// prepend ordering, partial updates, and active-note bookkeeping on delete.

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

test('addNote generates an id, timestamps and safe defaults, then prepends', () => {
  const s = useStore.getState();
  const note = s.addNote(makeNote('Physics'));
  assert.ok(note.id, 'an id is always generated');
  assert.ok(note.createdAt, 'a created timestamp is set');
  assert.ok(note.updatedAt, 'an updated timestamp is set');
  assert.equal(note.revisionStreak, 0);
  assert.equal(note.pinLock, null);
  assert.equal(note.categoryId, null);
  assert.equal(note.folderId, null);
  assert.deepEqual(note.tags, []);
  assert.equal(useStore.getState().notes[0].id, note.id, 'new notes go to the front of the list');
});

test('addNote accepts a caller-provided id', () => {
  const s = useStore.getState();
  const note = s.addNote({ ...makeNote('A'), id: 'note-42' });
  assert.equal(note.id, 'note-42');
});

test('addNote counts toward the daily goal, restarting on a new day', () => {
  const s = useStore.getState();
  s.addNote(makeNote('A'));
  assert.equal(useStore.getState().dailyProgress, 1);
  s.addNote(makeNote('B'));
  assert.equal(useStore.getState().dailyProgress, 2, 'a second note the same day counts again');
  useStore.setState((state) => ({ lastDailyReset: '2000-01-01' }));
  s.addNote(makeNote('C'));
  assert.equal(useStore.getState().dailyProgress, 1, 'a new calendar day restarts progress at 1');
});

test('updateNote merges a partial update and refreshes updatedAt only on the target', () => {
  const s = useStore.getState();
  const a = s.addNote(makeNote('A'));
  const b = s.addNote(makeNote('B'));
  // Stamp a stale updatedAt so we can prove the merge bumps it.
  useStore.setState((state) => ({
    notes: state.notes.map((n) => n.id === a.id ? { ...n, updatedAt: '2000-01-01T00:00:00.000Z' } : n),
  }));
  s.updateNote(a.id, { title: 'A2', isPinned: true });
  const notes = useStore.getState().notes;
  const updated = notes.find((n) => n.id === a.id)!;
  assert.equal(updated.title, 'A2');
  assert.equal(updated.isPinned, true);
  assert.equal(updated.content, 'content', 'untouched fields survive the merge');
  assert.notEqual(updated.updatedAt, '2000-01-01T00:00:00.000Z', 'updatedAt is refreshed');
  assert.equal(notes.find((n) => n.id === b.id)?.title, 'B', 'other notes are untouched');
});

test('deleteNote removes the note and clears activeNoteId when it was active', () => {
  const s = useStore.getState();
  const a = s.addNote(makeNote('A'));
  const b = s.addNote(makeNote('B'));
  s.setActiveNoteId(a.id);
  s.deleteNote(a.id);
  const state = useStore.getState();
  assert.equal(state.notes.some((n) => n.id === a.id), false);
  assert.equal(state.notes.some((n) => n.id === b.id), true);
  assert.equal(state.activeNoteId, null, 'deleting the active note clears the editor target');
});

test('deleteNote keeps activeNoteId when a different note is deleted', () => {
  const s = useStore.getState();
  const a = s.addNote(makeNote('A'));
  const b = s.addNote(makeNote('B'));
  s.setActiveNoteId(a.id);
  s.deleteNote(b.id);
  assert.equal(useStore.getState().activeNoteId, a.id);
});
