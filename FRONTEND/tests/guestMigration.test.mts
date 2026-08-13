import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  switchStoreScopeForUser,
  useStore,
  migrateGuestDataForUser,
  persistKeyForScope,
} from '../lib/store/useStore.ts';
import { mergeById, mergeGuestIntoUser, normalizeGuestData, summarizeGuestData } from '../lib/migration.ts';

// Day 9 Task 16 — before sign-in the app persists under the anonymous scope.
// When the guest finally signs in, that data must be folded into the account
// (dedupe by id) and the guest scope cleared, with a notice summary returned.

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

function makeNote(id: string) {
  return {
    id,
    title: `Note ${id}`,
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeVoiceNote(id: string) {
  return {
    id,
    noteId: null,
    audioId: `audio-${id}`,
    audioUrl: null,
    synced: false,
    updatedAt: new Date().toISOString(),
    duration: 1,
    transcript: null,
    createdAt: new Date().toISOString(),
  };
}

function seedGuestScope(overrides: Record<string, unknown> = {}) {
  const guestState = {
    notes: [makeNote('g1'), makeNote('g2')],
    voiceNotes: [makeVoiceNote('v1')],
    categories: [{ id: 'cat-custom', name: 'Custom', color: '#fff' }],
    folders: [{ id: 'f1', name: 'Folder' }],
    revisionLogs: [{ id: 'r1', noteId: 'g1', revisedAt: '2026-01-01', rating: 'medium' as const, nextScheduledAt: '2026-01-08' }],
    coins: 50,
    earnedAchievements: ['first-note', 'night-owl'],
    ...overrides,
  };
  g.window.localStorage.setItem(persistKeyForScope(null), JSON.stringify({ state: guestState, version: 0 }));
  return guestState;
}

beforeEach(() => {
  g.window = {
    localStorage: makeLocalStorage(),
    dispatchEvent: () => true,
  };
  // Force a full store reset: bounce through the anonymous scope first so the
  // per-test "test-user" switch can't short-circuit on a stale active scope.
  switchStoreScopeForUser(null);
  switchStoreScopeForUser('test-user');
});

test('mergeById appends incoming ids but never duplicates', () => {
  const merged = mergeById(
    [{ id: 'a', name: 'keep' }, { id: 'b', name: 'keep' }],
    [{ id: 'b', name: 'dup' }, { id: 'c', name: 'new' }],
  );
  assert.deepEqual(merged.map((x) => x.id), ['a', 'b', 'c']);
  assert.equal(merged[1].name, 'keep');
});

test('normalizeGuestData guards missing and malformed fields', () => {
  assert.deepEqual(normalizeGuestData(null), { notes: [], voiceNotes: [], categories: [], folders: [], revisionLogs: [], coins: 0, earnedAchievements: [] });
  assert.equal(normalizeGuestData({ coins: 'abc' } as unknown as Parameters<typeof normalizeGuestData>[0]).coins, 0);
  assert.equal(normalizeGuestData({ coins: 7 }).coins, 7);
});

test('summarizeGuestData returns null for an empty guest scope', () => {
  assert.equal(summarizeGuestData(normalizeGuestData(null)), null);
});

test('summarizeGuestData counts what would move', () => {
  const result = summarizeGuestData(normalizeGuestData({ notes: [makeNote('a')], voiceNotes: [makeVoiceNote('b')], coins: 5 }));
  assert.deepEqual(result, { notes: 1, voiceNotes: 1, folders: 0, revisionLogs: 0, coins: 5 });
});

test('mergeGuestIntoUser merges by id, sums coins, unions achievements', () => {
  const user = {
    notes: [makeNote('g1'), makeNote('u1')],
    voiceNotes: [makeVoiceNote('v1'), makeVoiceNote('v2')],
    categories: [{ id: 'cat-physics', name: 'Physics', color: '#3B82F6' }],
    folders: [] as { id: string; name: string }[],
    revisionLogs: [] as { id: string; noteId: string; revisedAt: string; rating: 'easy' | 'medium' | 'hard'; nextScheduledAt: string }[],
    coins: 10,
    earnedAchievements: ['first-note'] as string[],
  };
  const guest = normalizeGuestData({
    notes: [makeNote('g1'), makeNote('g2')],
    voiceNotes: [makeVoiceNote('v1')],
    categories: [{ id: 'cat-custom', name: 'Custom', color: '#fff' }],
    folders: [{ id: 'f1', name: 'Folder' }],
    revisionLogs: [{ id: 'r1', noteId: 'g1', revisedAt: '2026-01-01', rating: 'medium' as const, nextScheduledAt: '2026-01-08' }],
    coins: 50,
    earnedAchievements: ['night-owl'],
  });
  const { merged, result } = mergeGuestIntoUser(user, guest);
  assert.deepEqual(merged.notes.map((n) => n.id), ['g1', 'u1', 'g2']);
  assert.deepEqual(merged.voiceNotes.map((v) => v.id), ['v1', 'v2']);
  assert.deepEqual(merged.folders.map((f) => f.id), ['f1']);
  assert.deepEqual(merged.revisionLogs.map((r) => r.id), ['r1']);
  assert.equal(merged.coins, 60);
  assert.deepEqual(merged.earnedAchievements, ['first-note', 'night-owl']);
  assert.deepEqual(result, { notes: 2, voiceNotes: 1, folders: 1, revisionLogs: 1, coins: 50 });
});

test('migrateGuestDataForUser folds guest scope into the account', () => {
  seedGuestScope();
  const result = migrateGuestDataForUser('test-user');
  assert.deepEqual(result, { notes: 2, voiceNotes: 1, folders: 1, revisionLogs: 1, coins: 50 });
  const state = useStore.getState();
  assert.equal(state.notes.length, 2);
  assert.equal(state.voiceNotes.length, 1);
  assert.equal(state.folders.length, 1);
  assert.equal(state.coins, 50);
  assert.equal(state.guestMigration?.notes, 2);
  assert.equal(g.window.localStorage.getItem(persistKeyForScope(null)), null);
});

test('migrateGuestDataForUser does not overwrite existing account data', () => {
  seedGuestScope();
  useStore.getState().addNote({ title: 'Existing', content: 'x', tags: [], isPinned: false, isFavorite: false, pinLock: null, categoryId: null, folderId: null, lastRevisedAt: null, nextRevisionAt: null, revisionStreak: 0 });
  const before = useStore.getState().notes.length;
  migrateGuestDataForUser('test-user');
  const after = useStore.getState().notes;
  assert.equal(after.length, before + 2);
});

test('migrateGuestDataForUser returns null and clears nothing when guest scope is empty', () => {
  const result = migrateGuestDataForUser('test-user');
  assert.equal(result, null);
  assert.equal(useStore.getState().guestMigration, null);
});

test('migrateGuestDataForUser is idempotent after the guest scope is cleared', () => {
  seedGuestScope();
  const first = migrateGuestDataForUser('test-user');
  const second = migrateGuestDataForUser('test-user');
  assert.ok(first);
  assert.equal(second, null);
  assert.equal(useStore.getState().notes.length, 2);
});