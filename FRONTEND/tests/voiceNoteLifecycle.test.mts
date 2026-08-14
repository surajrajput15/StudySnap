import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { switchStoreScopeForUser, useStore } from '../lib/store/useStore.ts';

// Day 13 Task 5 — Voice-note lifecycle at the store level: normalization of
// empty noteId / synced / audioUrl, prepend ordering, transcript updates and
// targeted deletion.

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

function makeVoiceNote(overrides: Record<string, unknown> = {}) {
  return {
    noteId: null,
    audioId: 'audio-1',
    audioUrl: null,
    synced: false,
    updatedAt: new Date().toISOString(),
    duration: 1,
    transcript: 'transcript',
    ...overrides,
  };
}

test('addVoiceNote normalizes an empty noteId to null and defaults synced/audioUrl', () => {
  const s = useStore.getState();
  const vn = s.addVoiceNote(makeVoiceNote({ noteId: '' }));
  assert.ok(vn.id, 'an id is always generated');
  assert.equal(vn.noteId, null, 'an empty-string noteId means standalone');
  assert.equal(vn.synced, false, 'a fresh memo is pending upload');
  assert.equal(vn.audioUrl, null, 'no Cloudinary URL yet');
  assert.equal(useStore.getState().voiceNotes[0].id, vn.id, 'new memos are prepended');
});

test('addVoiceNote honors a caller-provided id and synced flag', () => {
  const s = useStore.getState();
  const vn = s.addVoiceNote(makeVoiceNote({ id: 'custom-id', synced: true }));
  assert.equal(vn.id, 'custom-id');
  assert.equal(useStore.getState().voiceNotes[0].synced, true);
});

test('recording a voice note is real study activity', () => {
  const s = useStore.getState();
  s.addVoiceNote(makeVoiceNote());
  assert.equal(useStore.getState().user.streakCount, 1);
  assert.equal(useStore.getState().dailyProgress, 1);
});

test('updateVoiceNote refreshes the transcript and updatedAt on the target only', () => {
  const s = useStore.getState();
  const a = s.addVoiceNote(makeVoiceNote());
  const b = s.addVoiceNote(makeVoiceNote());
  useStore.setState((state) => ({
    voiceNotes: state.voiceNotes.map((vn) => vn.id === a.id ? { ...vn, updatedAt: '2000-01-01T00:00:00.000Z' } : vn),
  }));
  s.updateVoiceNote(a.id, { transcript: 'revised transcript' });
  const memos = useStore.getState().voiceNotes;
  assert.equal(memos.find((vn) => vn.id === a.id)?.transcript, 'revised transcript');
  assert.notEqual(memos.find((vn) => vn.id === a.id)?.updatedAt, '2000-01-01T00:00:00.000Z', 'updatedAt is refreshed');
  assert.equal(memos.find((vn) => vn.id === b.id)?.transcript, 'transcript', 'other memos are untouched');
});

test('deleteVoiceNote removes only the targeted memo', () => {
  const s = useStore.getState();
  const a = s.addVoiceNote(makeVoiceNote());
  const b = s.addVoiceNote(makeVoiceNote());
  s.deleteVoiceNote(a.id);
  const memos = useStore.getState().voiceNotes;
  assert.equal(memos.some((vn) => vn.id === a.id), false);
  assert.equal(memos.some((vn) => vn.id === b.id), true);
});