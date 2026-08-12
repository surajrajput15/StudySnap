import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { VoiceNote } from '../lib/store/useStore.ts';
import { switchStoreScopeForUser, useStore } from '../lib/store/useStore.ts';
import {
  uploadVoiceNote,
  deleteRemoteVoiceNote,
  syncVoiceNotesForUser,
  sweepOrphanedVoiceAudio,
  type ServerVoiceNoteRow,
} from '../lib/sync/voiceNotesSync.ts';
import { saveVoiceAudio, purgeOrphanedVoiceAudio, resetVoiceAudioStore, getVoiceAudio } from '../lib/storage/voiceNotes.ts';

const NOW = '2026-08-12T10:00:00.000Z';
const LATER = '2026-08-12T10:00:05.000Z';
const AUDIO_URL = 'https://res.cloudinary.com/studysnap/video/upload/v1/voice/userA/demo';
const VTOMBSTONE_KEY_PREFIX = 'studysnap:vtombstones';
const STORE_PREFIX = 'studysnap-store';

let requestLog: { method: string; url: string; body: string | null; form: FormData | null }[] = [];
let pendingRequests: { method: string; url: string; body: string | null; form: FormData | null; resolve: (body: unknown) => void }[] = [];

function deferredValue<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
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
  fetch: unknown;
  window: { localStorage: Storage; dispatchEvent: () => boolean };
  navigator: { onLine: boolean };
}

const g = globalThis as unknown as TestGlobal;

function installFetchStub(): void {
  g.fetch = (url: string, init?: RequestInit): Promise<unknown> => {
    const deferred = deferredValue<unknown>();
    const body = init?.body;
    const rec = {
      method: (init?.method ?? 'GET').toUpperCase(),
      url: String(url),
      body: typeof body === 'string' ? body : null,
      form: typeof FormData !== 'undefined' && body instanceof FormData ? body : null,
      resolve: (reply: unknown) => deferred.resolve({ status: 200, json: async () => reply }),
    };
    requestLog.push(rec);
    pendingRequests.push(rec);
    return deferred.promise;
  };
}

function setOnline(on: boolean): void {
  try {
    Object.defineProperty(g.navigator, 'onLine', { configurable: true, value: on });
  } catch {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: on } });
  }
}

function tokenFn(): Promise<string | null> {
  return Promise.resolve('token-userA');
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((r) => setTimeout(r, 10));
}

function takePending(method: string, urlPart?: string): { method: string; url: string; body: string | null; form: FormData | null; resolve: (body: unknown) => void } {
  const idx = pendingRequests.findIndex((r) => r.method === method && (urlPart === undefined || r.url.includes(urlPart)));
  assert.ok(idx !== -1, `expected a pending ${method} request${urlPart ? ` matching ${urlPart}` : ''}`);
  const [rec] = pendingRequests.splice(idx, 1);
  return rec;
}

function takeUpload(noteId: string): { form: FormData; resolve: (body: unknown) => void } {
  const idx = pendingRequests.findIndex((r) => r.method === 'POST' && r.form !== null && r.form.get('id') === noteId);
  assert.ok(idx !== -1, `expected a pending multipart upload for ${noteId}`);
  const rec = pendingRequests[idx];
  assert.ok(rec.form, 'pending upload must carry a FormData body');
  pendingRequests.splice(idx, 1);
  return { form: rec.form, resolve: rec.resolve };
}

function sentDeletes(noteId: string): string[] {
  return requestLog.filter((r) => r.method === 'DELETE' && r.url.includes(noteId)).map((r) => r.url);
}

function sentUploads(): number {
  return requestLog.filter((r) => r.method === 'POST' && r.form !== null).length;
}

function readVTombstones(userId: string): Set<string> {
  const raw = g.window.localStorage.getItem(`${VTOMBSTONE_KEY_PREFIX}:${userId}`);
  if (!raw) return new Set();
  return new Set(JSON.parse(raw) as string[]);
}

function makeVoiceNote(overrides: Partial<VoiceNote> = {}): VoiceNote {
  return {
    id: 'vn-1',
    noteId: null,
    audioId: 'audio-1',
    audioUrl: null,
    synced: false,
    updatedAt: NOW,
    duration: 12,
    transcript: 'Hello study memo',
    createdAt: NOW,
    ...overrides,
  };
}

function serverVoiceNote(id: string, overrides: Partial<ServerVoiceNoteRow> = {}): ServerVoiceNoteRow {
  return {
    id,
    userId: 'userA',
    noteId: null,
    audioUrl: AUDIO_URL,
    duration: 12,
    transcript: 'Hello study memo',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

beforeEach(async () => {
  g.window = {
    localStorage: makeLocalStorage(),
    dispatchEvent: () => true,
  };
  requestLog = [];
  pendingRequests = [];
  installFetchStub();
  setOnline(true);
  await purgeOrphanedVoiceAudio([]);
  await resetVoiceAudioStore();
  switchStoreScopeForUser('userA');
  useStore.setState({ voiceNotes: [] });
});

test('V1 — upload after local save assembles a multipart FormData and marks the note synced', async () => {
  const note = makeVoiceNote({ id: 'vn-1', audioId: 'audio-1', noteId: null });
  await saveVoiceAudio('audio-1', new Blob(['audio-bytes-v1'], { type: 'audio/webm' }));
  useStore.setState({ voiceNotes: [note] });

  const upload = uploadVoiceNote(note, tokenFn);
  await flushMicrotasks();
  const { form, resolve } = takeUpload('vn-1');
  assert.ok(form, 'upload must be a multipart FormData request');
  assert.equal(form.get('id'), 'vn-1');
  assert.equal(form.get('noteId'), '', 'standalone noteId (null) is sent as the empty string');
  assert.equal(form.get('duration'), '12');
  assert.equal(form.get('transcript'), 'Hello study memo');
  const file = form.get('file') as File;
  assert.ok(file instanceof Blob, 'file field must carry the audio blob');
  assert.equal(await file.text(), 'audio-bytes-v1');
  assert.equal(file.type, 'audio/webm');

  resolve({ success: true, voiceNote: serverVoiceNote('vn-1', { audioUrl: AUDIO_URL, updatedAt: LATER }) });
  await upload;
  await flushMicrotasks();

  const after = useStore.getState().voiceNotes.find((vn) => vn.id === 'vn-1');
  assert.ok(after);
  assert.equal(after.synced, true, 'confirmed upload marks the note synced');
  assert.equal(after.audioUrl, AUDIO_URL, 'server Cloudinary URL adopted');
  assert.equal(after.updatedAt, LATER, 'server clock adopted');
  assert.equal(after.audioId, 'audio-1', 'IndexedDB blob handle preserved as primary source');
});

test('V2 — linked (non-standalone) notes forward their noteId field', async () => {
  const note = makeVoiceNote({ id: 'vn-2', noteId: 'linked-note-uuid', audioId: 'audio-2' });
  await saveVoiceAudio('audio-2', new Blob(['bytes-2'], { type: 'audio/webm' }));
  useStore.setState({ voiceNotes: [note] });

  const upload = uploadVoiceNote(note, tokenFn);
  await flushMicrotasks();
  const { form, resolve } = takeUpload('vn-2');
  assert.equal(form.get('noteId'), 'linked-note-uuid');
  resolve({ success: true, voiceNote: serverVoiceNote('vn-2', { noteId: 'linked-note-uuid' }) });
  await upload;
  await flushMicrotasks();
});

test('V3 — a failed upload leaves the note pending (synced false, no URL)', async () => {
  const note = makeVoiceNote({ id: 'vn-3', audioId: 'audio-3' });
  await saveVoiceAudio('audio-3', new Blob(['bytes-3'], { type: 'audio/webm' }));
  useStore.setState({ voiceNotes: [note] });

  const upload = uploadVoiceNote(note, tokenFn);
  await flushMicrotasks();
  const { resolve } = takeUpload('vn-3');
  resolve({ success: false, error: 'boom' });
  await upload;
  await flushMicrotasks();

  const after = useStore.getState().voiceNotes.find((vn) => vn.id === 'vn-3');
  assert.ok(after);
  assert.equal(after.synced, false, 'row stays pending on failure');
  assert.equal(after.audioUrl, null, 'no fake URL adopted');
});

test('V4 — offline upload is skipped entirely and stays pending', async () => {
  const note = makeVoiceNote({ id: 'vn-4', audioId: 'audio-4' });
  await saveVoiceAudio('audio-4', new Blob(['bytes-4'], { type: 'audio/webm' }));
  useStore.setState({ voiceNotes: [note] });

  setOnline(false);
  await uploadVoiceNote(note, tokenFn);
  await flushMicrotasks();

  assert.equal(sentUploads(), 0, 'no network request while offline');
  const after = useStore.getState().voiceNotes.find((vn) => vn.id === 'vn-4');
  assert.equal(after?.synced, false, 'still pending for a later reconnect');
});

test('V5 — guest scope upload is a no-op', async () => {
  await saveVoiceAudio('audio-5', new Blob(['bytes-5'], { type: 'audio/webm' }));
  switchStoreScopeForUser(null);
  const note = makeVoiceNote({ id: 'vn-5', audioId: 'audio-5' });

  await uploadVoiceNote(note, tokenFn);
  await flushMicrotasks();

  assert.equal(sentUploads(), 0, 'guest scope never uploads');
});

test('V6 — an already-synced note is not re-uploaded', async () => {
  const note = makeVoiceNote({ id: 'vn-6', audioId: 'audio-6', synced: true, audioUrl: AUDIO_URL, updatedAt: LATER });
  await saveVoiceAudio('audio-6', new Blob(['bytes-6'], { type: 'audio/webm' }));
  useStore.setState({ voiceNotes: [note] });

  await uploadVoiceNote(note, tokenFn);
  await flushMicrotasks();

  assert.equal(sentUploads(), 0, 'no redundant upload for a confirmed row');
});

test('V7 — a note whose IndexedDB blob is gone cannot upload and stays pending', async () => {
  const note = makeVoiceNote({ id: 'vn-7', audioId: 'audio-missing' });
  useStore.setState({ voiceNotes: [note] });

  await uploadVoiceNote(note, tokenFn);
  await flushMicrotasks();

  assert.equal(sentUploads(), 0, 'no upload without durable bytes');
  const after = useStore.getState().voiceNotes.find((vn) => vn.id === 'vn-7');
  assert.equal(after?.synced, false, 'row remains pending');
});

test('V8 — delete issues a remote DELETE and clears the tombstone on success', async () => {
  useStore.setState({ voiceNotes: [makeVoiceNote({ id: 'vn-8' })] });

  const del = deleteRemoteVoiceNote('vn-8', tokenFn);
  await flushMicrotasks();
  assert.ok(readVTombstones('userA').has('vn-8'), 'tombstone recorded immediately');

  const delReq = takePending('DELETE', 'vn-8');
  delReq.resolve({ success: true });
  await del;
  await flushMicrotasks();

  assert.ok(!readVTombstones('userA').has('vn-8'), 'tombstone cleared after confirmed DELETE');
  assert.equal(sentDeletes('vn-8').length, 1);
});

test('V9 — offline delete survives reconnect; flush DELETE runs before adoption so a stale server row cannot resurrect', async () => {
  useStore.setState({ voiceNotes: [makeVoiceNote({ id: 'vn-9' })] });

  setOnline(false);
  await deleteRemoteVoiceNote('vn-9', tokenFn);
  await flushMicrotasks();
  assert.equal(sentDeletes('vn-9').length, 0, 'offline delete issues no request');
  assert.ok(readVTombstones('userA').has('vn-9'), 'tombstone survives offline');

  setOnline(true);
  const sync = syncVoiceNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const delReq = takePending('DELETE', 'vn-9');
  delReq.resolve({ success: false }); // DELETE not yet confirmed → tombstone must hold
  await flushMicrotasks();
  assert.ok(readVTombstones('userA').has('vn-9'), 'tombstone retained after failed DELETE retry');

  const getReq = takePending('GET', '/api/voice-notes');
  getReq.resolve({ success: true, voiceNotes: [serverVoiceNote('vn-9')] });
  await sync;
  await flushMicrotasks();

  assert.equal(useStore.getState().voiceNotes.some((vn) => vn.id === 'vn-9'), false, 'deleted note never adopted');
  assert.equal(sentUploads(), 0, 'deleted note never re-uploaded');
});

test('V10 — hydration adopts a server-only note with its Cloudinary URL and synced=true', async () => {
  useStore.setState({ voiceNotes: [] });

  const sync = syncVoiceNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq = takePending('GET', '/api/voice-notes');
  getReq.resolve({ success: true, voiceNotes: [serverVoiceNote('vn-server-1', { updatedAt: LATER })] });
  await sync;
  await flushMicrotasks();

  const adopted = useStore.getState().voiceNotes.find((vn) => vn.id === 'vn-server-1');
  assert.ok(adopted, 'server-only voice note adopted into the store');
  assert.equal(adopted.audioUrl, AUDIO_URL);
  assert.equal(adopted.synced, true);
  assert.equal(adopted.audioId, null, 'no local blob handle for a remote-only note');
  assert.equal(sentUploads(), 0, 'adoption issues no upload');
});

test('V11 — LWW merge: a newer server row wins but the local IndexedDB handle is preserved', async () => {
  const local = makeVoiceNote({
    id: 'vn-11',
    audioId: 'audio-11',
    synced: false,
    transcript: 'older local transcript',
    updatedAt: NOW,
  });
  await saveVoiceAudio('audio-11', new Blob(['bytes-11'], { type: 'audio/webm' }));
  useStore.setState({ voiceNotes: [local] });
  await flushMicrotasks(); // let persist write the metadata first

  const sync = syncVoiceNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq = takePending('GET', '/api/voice-notes');
  getReq.resolve({
    success: true,
    voiceNotes: [serverVoiceNote('vn-11', { transcript: 'newer server transcript', duration: 45, updatedAt: LATER })],
  });
  await sync;
  await flushMicrotasks();

  const after = useStore.getState().voiceNotes.find((vn) => vn.id === 'vn-11');
  assert.ok(after);
  assert.equal(after.transcript, 'newer server transcript', 'server transcript adopted when newer');
  assert.equal(after.duration, 45, 'server duration adopted');
  assert.equal(after.audioUrl, AUDIO_URL, 'server URL adopted');
  assert.equal(after.synced, true);
  assert.equal(after.audioId, 'audio-11', 'local blob handle preserved for playback preference');
  assert.equal(sentUploads(), 0, 'server-winner merge issues no upload');
});

test('V12 — hydration uploads a local-only pending note (seed durability)', async () => {
  const note = makeVoiceNote({ id: 'vn-12', audioId: 'audio-12' });
  await saveVoiceAudio('audio-12', new Blob(['seed-bytes'], { type: 'audio/ogg' }));
  useStore.setState({ voiceNotes: [note] });

  const sync = syncVoiceNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq = takePending('GET', '/api/voice-notes');
  getReq.resolve({ success: true, voiceNotes: [] }); // empty server store
  await flushMicrotasks();
  const { form, resolve } = takeUpload('vn-12');
  assert.equal(form.get('id'), 'vn-12');
  const file = form.get('file') as File;
  assert.equal(await file.text(), 'seed-bytes');

  resolve({ success: true, voiceNote: serverVoiceNote('vn-12', { updatedAt: LATER }) });
  await sync;
  await flushMicrotasks();

  const after = useStore.getState().voiceNotes.find((vn) => vn.id === 'vn-12');
  assert.ok(after, 'local note never dropped by the merge');
  assert.equal(after.synced, true, 'seeded local note confirmed on the server');
  assert.equal(after.updatedAt, LATER);
});

test('V13 — a tombstoned local note is never uploaded and a server row for it never resurrects', async () => {
  g.window.localStorage.setItem(`${VTOMBSTONE_KEY_PREFIX}:userA`, JSON.stringify(['vn-13']));
  const note = makeVoiceNote({ id: 'vn-13', audioId: 'audio-13' });
  await saveVoiceAudio('audio-13', new Blob(['bytes-13'], { type: 'audio/webm' }));
  useStore.setState({ voiceNotes: [note] });

  const sync = syncVoiceNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  // The flush retry DELETE fails, keeping the tombstone for the merge below.
  const delReq = takePending('DELETE', 'vn-13');
  delReq.resolve({ success: false });
  await flushMicrotasks();
  assert.ok(readVTombstones('userA').has('vn-13'));

  const getReq = takePending('GET', '/api/voice-notes');
  getReq.resolve({ success: true, voiceNotes: [serverVoiceNote('vn-13', { updatedAt: LATER })] });
  await sync;
  await flushMicrotasks();

  assert.equal(useStore.getState().voiceNotes.some((vn) => vn.id === 'vn-13'), false, 'tombstoned note never resurrected');
  assert.equal(sentUploads(), 0, 'tombstoned note never uploaded');
});

test('V14 — safe orphan sweep keeps every account’s audio and purges only genuinely-orphaned blobs', async () => {
  // Account A (current scope) references audio-a; the persisted store metadata
  // written by zustand already carries it (see persist partialize).
  useStore.setState({ voiceNotes: [makeVoiceNote({ id: 'vn-a', audioId: 'audio-a' })] });
  // Account B metadata references audio-b.
  g.window.localStorage.setItem(
    `${STORE_PREFIX}:userB`,
    JSON.stringify({ state: { voiceNotes: [{ id: 'vn-b', noteId: null, audioId: 'audio-b', updatedAt: NOW, createdAt: NOW }] }, version: 0 })
  );
  await saveVoiceAudio('audio-a', new Blob(['a'], { type: 'audio/webm' }));
  await saveVoiceAudio('audio-b', new Blob(['b'], { type: 'audio/webm' }));
  await saveVoiceAudio('audio-orphan', new Blob(['x'], { type: 'audio/webm' }));

  await sweepOrphanedVoiceAudio();

  assert.ok(await getVoiceAudio('audio-a'), 'current account audio kept');
  assert.ok(await getVoiceAudio('audio-b'), 'another account’s audio kept (never swept across scopes)');
  assert.equal(await getVoiceAudio('audio-orphan'), null, 'genuinely-orphaned blob purged');
});

test('V15 — an in-flight Account A upload cannot mutate Account B after a scope switch', async () => {
  const noteA = makeVoiceNote({ id: 'vn-15', audioId: 'audio-15', transcript: 'Account A memo' });
  await saveVoiceAudio('audio-15', new Blob(['bytes-15'], { type: 'audio/webm' }));
  useStore.setState({ voiceNotes: [noteA] });

  const uploadA = uploadVoiceNote(noteA, tokenFn);
  await flushMicrotasks();
  const uploadAReq = takeUpload('vn-15');

  // Mid-flight account switch to Account B. B has its own (empty) store.
  switchStoreScopeForUser('userB');
  assert.equal(useStore.getState().voiceNotes.some((vn) => vn.id === 'vn-15'), false, 'B has no trace of A’s note');

  // A's upload completes after the switch — captured scope is Account A, which
  // no longer matches, so it must abort without writing into B's store.
  uploadAReq.resolve({ success: true, voiceNote: serverVoiceNote('vn-15', { userId: 'userA', updatedAt: LATER }) });
  await uploadA;
  await flushMicrotasks();

  assert.equal(useStore.getState().voiceNotes.some((vn) => vn.id === 'vn-15'), false, 'B store untouched by A’s upload');
});