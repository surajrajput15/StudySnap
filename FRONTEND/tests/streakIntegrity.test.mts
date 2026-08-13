import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { switchStoreScopeForUser, useStore } from '../lib/store/useStore.ts';

// Day 9 Task 13 — the streak used to be incremented by CLICKING the streak
// display on the dashboard (HomeScreen.handleStreakClick), so anyone could build
// an infinite streak without studying. It now advances only through real study
// activity (addNote / addVoiceNote / markAsRevised), and a fresh account starts
// at 0 instead of a fabricated "1".

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

beforeEach(() => {
  g.window = {
    localStorage: makeLocalStorage(),
    dispatchEvent: () => true,
  };
  switchStoreScopeForUser('test-user');
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

test('a fresh account starts with a zero streak and no last-active date', () => {
  assert.equal(useStore.getState().user.streakCount, 0);
  assert.equal(useStore.getState().user.lastActiveDate, null);
});

test('the public incrementStreak action no longer exists', () => {
  const actions = useStore.getState() as unknown as Record<string, unknown>;
  assert.equal(actions.incrementStreak, undefined, 'clicking the streak must have nothing to call');
});

test('creating a note advances the streak to 1 on the first day of activity', () => {
  const s = useStore.getState();
  s.addNote(makeNote('Chem'));
  assert.equal(useStore.getState().user.streakCount, 1);
  assert.ok(useStore.getState().user.lastActiveDate);
});

test('multiple study actions on the same day count once', () => {
  const s = useStore.getState();
  s.addNote(makeNote('A'));
  s.addVoiceNote(makeVoiceNote());
  s.markAsRevised('note-1', 'easy');
  assert.equal(useStore.getState().user.streakCount, 1, 'same-day activity must not double count');
});

test('a gap of 2+ days resets the streak back to 1', () => {
  const s = useStore.getState();
  s.addNote(makeNote('A'));
  // Simulate the user last being active 3 days ago.
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  useStore.setState((state) => ({
    user: { ...state.user, lastActiveDate: threeDaysAgo.toISOString().split('T')[0] },
  }));
  s.addNote(makeNote('B'));
  assert.equal(useStore.getState().user.streakCount, 1, 'stale activity must break the streak');
});

test('sync-style state merges never touch the streak', () => {
  const s = useStore.getState();
  s.addNote(makeNote('A'));
  assert.equal(useStore.getState().user.streakCount, 1);
  // The sync layer hydrates via setState merges, not the activity actions, so a
  // server hydration must not bump the streak.
  useStore.setState((state) => ({ notes: [...state.notes] }));
  assert.equal(useStore.getState().user.streakCount, 1);
});