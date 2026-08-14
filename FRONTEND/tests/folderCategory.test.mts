import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { switchStoreScopeForUser, useStore } from '../lib/store/useStore.ts';

// Day 13 Task 4 — Folder/category store actions: id generation, detachment on
// delete (category), cascade on delete (folder), and the guarantee that
// organizing data is NOT study activity (never touches progress or streak).

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

test('addCategory generates an id and appends', () => {
  const s = useStore.getState();
  const cat = s.addCategory({ name: 'Maths', color: '#0061A4' });
  assert.ok(cat.id);
  const categories = useStore.getState().categories;
  assert.equal(categories[categories.length - 1].id, cat.id, 'new categories are appended');
});

test('addFolder generates an id and appends', () => {
  const s = useStore.getState();
  const folder = s.addFolder({ name: 'Semester 2' });
  assert.ok(folder.id);
  const folders = useStore.getState().folders;
  assert.equal(folders[folders.length - 1].id, folder.id, 'new folders are appended');
});

test('adding folders or categories is not study activity', () => {
  const s = useStore.getState();
  s.addFolder({ name: 'F1' });
  s.addCategory({ name: 'C1', color: '#fff' });
  assert.equal(useStore.getState().dailyProgress, 0);
  assert.equal(useStore.getState().user.streakCount, 0);
});

test('deleteCategory detaches its notes and clears the active category filter', () => {
  const s = useStore.getState();
  const cat = s.addCategory({ name: 'Maths', color: '#0061A4' });
  const note = s.addNote({ ...makeNote('Algebra'), categoryId: cat.id });
  s.setActiveCategoryId(cat.id);
  s.deleteCategory(cat.id);
  const state = useStore.getState();
  assert.equal(state.categories.some((c) => c.id === cat.id), false);
  assert.equal(state.notes.find((n) => n.id === note.id)?.categoryId, null, 'the note is detached, not deleted');
  assert.equal(state.activeCategoryId, null, 'the filter is cleared');
});

test('deleteFolder cascades the notes inside it but leaves others alone', () => {
  const s = useStore.getState();
  const folder = s.addFolder({ name: 'F' });
  const inside = s.addNote({ ...makeNote('In'), folderId: folder.id });
  const outside = s.addNote(makeNote('Out'));
  s.setActiveFolderId(folder.id);
  s.deleteFolder(folder.id);
  const state = useStore.getState();
  assert.equal(state.folders.some((f) => f.id === folder.id), false);
  assert.equal(state.notes.some((n) => n.id === inside.id), false, 'notes inside the folder are cascaded');
  assert.equal(state.notes.some((n) => n.id === outside.id), true, 'notes outside the folder survive');
  assert.equal(state.activeFolderId, null, 'the filter is cleared');
});