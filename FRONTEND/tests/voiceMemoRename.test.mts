import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Note, VoiceNote } from '../lib/store/useStore.ts';
import { switchStoreScopeForUser, useStore } from '../lib/store/useStore.ts';

const NOW = '2026-08-13T10:00:00.000Z';

function makeNote(id: string, title: string): Note {
  return {
    id,
    title,
    content: '<p>Body</p>',
    tags: [],
    isPinned: false,
    isFavorite: false,
    pinLock: null,
    categoryId: null,
    folderId: null,
    lastRevisedAt: null,
    nextRevisionAt: null,
    revisionStreak: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeVoiceNote(id: string, opts: { transcript?: string | null; noteId?: string | null; duration?: number; updatedAt?: string } = {}): VoiceNote {
  return {
    id,
    noteId: opts.noteId ?? null,
    audioId: `audio-${id}`,
    audioUrl: null,
    synced: false,
    updatedAt: opts.updatedAt ?? NOW,
    duration: opts.duration ?? 30,
    transcript: opts.transcript ?? `Transcript for ${id}`,
    createdAt: NOW,
  };
}

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

function persistedVoiceNote(id: string): VoiceNote | undefined {
  const raw = g.window.localStorage.getItem('studysnap-store:userA');
  if (!raw) return undefined;
  const parsed = JSON.parse(raw) as { state?: { voiceNotes?: VoiceNote[] } };
  return parsed.state?.voiceNotes?.find((vn) => vn.id === id);
}

beforeEach(() => {
  g.window = {
    localStorage: makeLocalStorage(),
    dispatchEvent: () => true,
  };
  switchStoreScopeForUser('userA');
});

// Day 9 Task 5 — regression: renaming a voice memo used to only touch a linked
// note's title, so a standalone memo (noteId null, the default for recordings)
// could never be renamed and the memo's own title never changed. The memo's
// transcript IS its title; renaming must update it in the store, bump updatedAt
// so LWW keeps the local rename over a stale server row, and stay local-only
// (transcript rename re-uploads are documented out of scope for sync).

test('Standalone memo rename updates its transcript and preserves all metadata', () => {
  useStore.setState({ voiceNotes: [makeVoiceNote('memo-1', { transcript: 'Original name' })] });

  useStore.getState().updateVoiceNote('memo-1', { transcript: 'Renamed title' });

  const vn = useStore.getState().voiceNotes[0];
  assert.equal(vn.transcript, 'Renamed title', 'the memo title itself is renamed');
  assert.equal(vn.noteId, null, 'standalone memo stays unlinked');
  assert.equal(vn.audioId, 'audio-memo-1', 'durable blob reference untouched');
  assert.equal(vn.duration, 30, 'duration untouched');
  assert.equal(vn.createdAt, NOW, 'createdAt untouched');
});

test('Rename bumps updatedAt so LWW favors the local rename over a stale server row', () => {
  useStore.setState({ voiceNotes: [makeVoiceNote('memo-2', { updatedAt: '2026-01-01T00:00:00.000Z' })] });

  useStore.getState().updateVoiceNote('memo-2', { transcript: 'Newer name' });

  const vn = useStore.getState().voiceNotes[0];
  assert.equal(vn.transcript, 'Newer name');
  assert.ok(
    new Date(vn.updatedAt as string).getTime() > new Date('2026-01-01T00:00:00.000Z').getTime(),
    'updatedAt advances past the stale server timestamp',
  );
});

test('Renaming does not touch the notes slice even for a linked memo', () => {
  const memo = makeVoiceNote('memo-linked', { noteId: 'note-1' });
  useStore.setState({
    voiceNotes: [memo],
    notes: [makeNote('note-1', 'Note title')],
  });

  useStore.getState().updateVoiceNote('memo-linked', { transcript: 'Memo renamed' });

  assert.equal(useStore.getState().voiceNotes[0].transcript, 'Memo renamed');
  assert.equal(useStore.getState().notes.length, 1, 'notes slice untouched by the voice-note action');
  assert.equal(useStore.getState().notes[0].title, 'Note title');
});

test('Unknown id is a no-op', () => {
  useStore.setState({ voiceNotes: [makeVoiceNote('memo-a')] });

  useStore.getState().updateVoiceNote('does-not-exist', { transcript: 'Ignored' });

  assert.equal(useStore.getState().voiceNotes.length, 1);
  assert.equal(useStore.getState().voiceNotes[0].transcript, 'Transcript for memo-a');
});

test('Relinking a memo via updateVoiceNote sets noteId without losing the transcript', () => {
  useStore.setState({ voiceNotes: [makeVoiceNote('memo-relink')] });

  useStore.getState().updateVoiceNote('memo-relink', { noteId: 'note-9' });

  const vn = useStore.getState().voiceNotes[0];
  assert.equal(vn.noteId, 'note-9');
  assert.equal(vn.transcript, 'Transcript for memo-relink');
});

test('The rename is persisted to the user-scoped store', () => {
  useStore.setState({ voiceNotes: [makeVoiceNote('memo-persist', { transcript: 'Before' })] });

  useStore.getState().updateVoiceNote('memo-persist', { transcript: 'After' });

  assert.equal(persistedVoiceNote('memo-persist')?.transcript, 'After', 'renamed transcript persisted');
});