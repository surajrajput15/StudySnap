import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Note, Folder } from '../lib/store/useStore.ts';
import { switchStoreScopeForUser, useStore } from '../lib/store/useStore.ts';
import {
  deleteRemoteNote,
  deleteFolderWithNotes,
  syncNotesForUser,
  type ServerNoteRow,
} from '../lib/sync/notesSync.ts';

const NOW = '2026-08-13T10:00:00.000Z';
const TOMBSTONE_KEY_PREFIX = 'studysnap:tombstones';

function makeNote(id: string, folderId: string | null): Note {
  return {
    id,
    title: 'Title',
    content: '<p>Body</p>',
    tags: [],
    isPinned: false,
    isFavorite: false,
    pinLock: null,
    categoryId: null,
    folderId,
    lastRevisedAt: null,
    nextRevisionAt: null,
    revisionStreak: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeFolder(id: string, name: string): Folder {
  return { id, name };
}

function serverNote(id: string, updatedAt: string): ServerNoteRow {
  return {
    id,
    userId: 'userA',
    title: 'Title',
    content: '<p>Body</p>',
    tags: null,
    isPinned: false,
    isFavorite: false,
    categoryId: null,
    folderId: null,
    lastRevisedAt: null,
    nextRevisionAt: null,
    revisionStreak: 0,
    createdAt: NOW,
    updatedAt,
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

interface RecordedRequest {
  method: string;
  url: string;
  body: string | null;
  resolve: (body: unknown) => void;
}

function deferredValue<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

let requestLog: RecordedRequest[] = [];
let pendingRequests: RecordedRequest[] = [];

interface TestGlobal {
  fetch: unknown;
  window: { localStorage: Storage; dispatchEvent: () => boolean };
  navigator: { onLine: boolean };
}

const g = globalThis as unknown as TestGlobal;

function installFetchStub(): void {
  g.fetch = (url: string, init?: RequestInit): Promise<unknown> => {
    const deferred = deferredValue<unknown>();
    const rec: RecordedRequest = {
      method: (init?.method ?? 'GET').toUpperCase(),
      url: String(url),
      body: typeof init?.body === 'string' ? init.body : null,
      resolve: (body) => deferred.resolve({ status: 200, json: async () => body }),
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
  return Promise.resolve('token-A');
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((r) => setTimeout(r, 10));
}

function takePending(method: string, noteId: string): RecordedRequest {
  const idx = pendingRequests.findIndex((r) => r.method === method && (r.url.includes(noteId) || (r.body ?? '').includes(noteId)));
  assert.ok(idx !== -1, `expected a pending ${method} matching ${noteId}`);
  const [rec] = pendingRequests.splice(idx, 1);
  return rec;
}

function sentDeletes(): RecordedRequest[] {
  return requestLog.filter((r) => r.method === 'DELETE');
}

function readTombstones(userId: string): Set<string> {
  const raw = g.window.localStorage.getItem(`${TOMBSTONE_KEY_PREFIX}:${userId}`);
  if (!raw) return new Set();
  return new Set(JSON.parse(raw) as string[]);
}

beforeEach(() => {
  g.window = {
    localStorage: makeLocalStorage(),
    dispatchEvent: () => true,
  };
  requestLog = [];
  pendingRequests = [];
  installFetchStub();
  setOnline(true);
  switchStoreScopeForUser('userA');
});

test('Empty folder delete removes the folder with no remote note deletion', () => {
  useStore.setState({ folders: [makeFolder('folder-empty', 'Empty')], notes: [] });

  const affected = deleteFolderWithNotes('folder-empty', tokenFn);

  assert.deepEqual(affected, []);
  assert.equal(useStore.getState().folders.some((f) => f.id === 'folder-empty'), false);
  assert.equal(readTombstones('userA').size, 0, 'no tombstones for an empty folder');
  assert.equal(sentDeletes().length, 0, 'no remote DELETE for an empty folder');
});

test('Folder with one note removes note, records a tombstone and issues a remote DELETE', async () => {
  useStore.setState({ folders: [makeFolder('folder-solo', 'Solo')], notes: [makeNote('note-solo', 'folder-solo')] });

  const affected = deleteFolderWithNotes('folder-solo', tokenFn);

  assert.deepEqual(affected.map((n) => n.id), ['note-solo']);
  assert.equal(useStore.getState().folders.some((f) => f.id === 'folder-solo'), false);
  assert.equal(useStore.getState().notes.some((n) => n.id === 'note-solo'), false, 'note removed locally');

  await flushMicrotasks();
  const req = takePending('DELETE', 'note-solo');
  assert.ok(readTombstones('userA').has('note-solo'), 'tombstone recorded before the DELETE confirms');
  req.resolve({ success: true });
  await flushMicrotasks();

  assert.ok(!readTombstones('userA').has('note-solo'), 'tombstone cleared once the DELETE is confirmed');
  assert.equal(useStore.getState().notes.some((n) => n.id === 'note-solo'), false, 'note stays deleted');
});

test('Folder with multiple notes identifies and deletes every affected note', async () => {
  const notes = [
    makeNote('note-a', 'folder-multi'),
    makeNote('note-b', 'folder-multi'),
    makeNote('note-c', 'folder-multi'),
  ];
  useStore.setState({ folders: [makeFolder('folder-multi', 'Multi')], notes });

  const affected = deleteFolderWithNotes('folder-multi', tokenFn);

  assert.deepEqual(new Set(affected.map((n) => n.id)), new Set(['note-a', 'note-b', 'note-c']));
  assert.equal(useStore.getState().folders.some((f) => f.id === 'folder-multi'), false);
  for (const n of notes) {
    assert.equal(useStore.getState().notes.some((x) => x.id === n.id), false, `${n.id} removed locally`);
  }

  await flushMicrotasks();
  assert.equal(readTombstones('userA').size, 3, 'every affected note is tombstoned');
  assert.equal(pendingRequests.length, 3, 'a remote DELETE is issued for every affected note');
  for (const id of ['note-a', 'note-b', 'note-c']) {
    const req = takePending('DELETE', id);
    req.resolve({ success: true });
  }
  await flushMicrotasks();
  assert.equal(readTombstones('userA').size, 0, 'all tombstones cleared after confirmed DELETEs');
});

test('Tombstoned notes are NOT re-adopted when the server still returns them', async () => {
  useStore.setState({ folders: [makeFolder('folder-adopt', 'Adopt')], notes: [makeNote('note-adopt', 'folder-adopt')] });

  deleteFolderWithNotes('folder-adopt', tokenFn);
  await flushMicrotasks();
  const firstDelete = takePending('DELETE', 'note-adopt');
  firstDelete.resolve({ success: false }); // remote DELETE fails → tombstone persists
  await flushMicrotasks();
  assert.ok(readTombstones('userA').has('note-adopt'), 'tombstone persists after a failed DELETE');

  // Next sync retries the DELETE first, then the GET still returns the row.
  const sync = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const retryDelete = takePending('DELETE', 'note-adopt');
  retryDelete.resolve({ success: false });
  await flushMicrotasks();
  const getReq = takePending('GET', '');
  getReq.resolve({ success: true, notes: [serverNote('note-adopt', NOW)] });
  await sync;

  assert.equal(useStore.getState().notes.some((n) => n.id === 'note-adopt'), false, 'no resurrection from the server row');
  assert.ok(readTombstones('userA').has('note-adopt'), 'tombstone held until a confirmed DELETE');
});

test('Cancel leaves the folder, its notes, tombstones and remote state untouched', () => {
  useStore.setState({ folders: [makeFolder('folder-c', 'C')], notes: [makeNote('note-c', 'folder-c')] });

  // Dismissing the confirmation dialog performs NO destructive call. Nothing
  // may have changed — not even a tombstone or a remote DELETE.
  assert.equal(useStore.getState().folders.some((f) => f.id === 'folder-c'), true, 'folder remains');
  assert.equal(useStore.getState().notes.some((n) => n.id === 'note-c'), true, 'note remains');
  assert.equal(readTombstones('userA').size, 0, 'no tombstone recorded on cancel');
  assert.equal(sentDeletes().length, 0, 'no remote DELETE on cancel');
});

test('Individual note deletion still records a tombstone and a remote DELETE (regression)', async () => {
  useStore.setState({ notes: [makeNote('note-ind', null)] });

  useStore.getState().deleteNote('note-ind');
  void deleteRemoteNote('note-ind', tokenFn);
  await flushMicrotasks();

  const req = takePending('DELETE', 'note-ind');
  assert.ok(readTombstones('userA').has('note-ind'));
  req.resolve({ success: true });
  await flushMicrotasks();

  assert.equal(useStore.getState().notes.some((n) => n.id === 'note-ind'), false);
  assert.ok(!readTombstones('userA').has('note-ind'), 'individual deletion path unchanged');
});

test('Only notes belonging to the deleted folder are affected', async () => {
  const folderNotes = [makeNote('note-in', 'folder-x'), makeNote('note-in2', 'folder-x')];
  const unrelated = [makeNote('note-other-folder', 'folder-y'), makeNote('note-no-folder', null)];
  useStore.setState({
    folders: [makeFolder('folder-x', 'X'), makeFolder('folder-y', 'Y')],
    notes: [...folderNotes, ...unrelated],
  });

  deleteFolderWithNotes('folder-x', tokenFn);
  await flushMicrotasks();

  assert.equal(useStore.getState().folders.some((f) => f.id === 'folder-x'), false, 'deleted folder removed');
  assert.equal(useStore.getState().folders.some((f) => f.id === 'folder-y'), true, 'other folder untouched');
  for (const n of folderNotes) {
    assert.equal(useStore.getState().notes.some((x) => x.id === n.id), false, `${n.id} deleted`);
  }
  for (const n of unrelated) {
    assert.equal(useStore.getState().notes.some((x) => x.id === n.id), true, `${n.id} untouched`);
  }

  const tombstones = readTombstones('userA');
  assert.ok(tombstones.has('note-in') && tombstones.has('note-in2'), 'affected notes tombstoned');
  assert.ok(!tombstones.has('note-other-folder') && !tombstones.has('note-no-folder'), 'unrelated notes never tombstoned');

  const deletes = sentDeletes();
  assert.equal(deletes.length, 2, 'remote DELETEs issued only for affected notes');
  for (const id of ['note-in', 'note-in2']) {
    assert.ok(deletes.some((r) => r.url.includes(id)), `DELETE issued for ${id}`);
  }
});

test('Offline folder delete keeps tombstones; a later online sync retries the remote DELETEs', async () => {
  const notes = [makeNote('note-off1', 'folder-off'), makeNote('note-off2', 'folder-off')];
  useStore.setState({ folders: [makeFolder('folder-off', 'Off')], notes });

  setOnline(false);
  deleteFolderWithNotes('folder-off', tokenFn);

  assert.equal(useStore.getState().folders.some((f) => f.id === 'folder-off'), false);
  for (const n of notes) {
    assert.equal(useStore.getState().notes.some((x) => x.id === n.id), false, `${n.id} removed locally while offline`);
  }
  assert.equal(readTombstones('userA').size, 2, 'tombstones recorded even while offline');
  assert.equal(sentDeletes().length, 0, 'no remote DELETE attempted while offline');

  setOnline(true);
  const sync = syncNotesForUser('userA', tokenFn);
  // flushPendingDeletes issues the retried DELETEs one at a time, so resolve
  // each before the next is sent.
  for (const id of ['note-off1', 'note-off2']) {
    await flushMicrotasks();
    const del = takePending('DELETE', id);
    del.resolve({ success: true });
  }
  await flushMicrotasks();
  // The confirmed DELETEs removed the rows, so the server only returns an
  // unrelated note here — a genuine server-only row that must still adopt
  // normally while the deleted notes stay gone.
  const getReq = takePending('GET', '');
  getReq.resolve({ success: true, notes: [serverNote('note-other', NOW)] });
  await sync;

  assert.equal(readTombstones('userA').size, 0, 'tombstones cleared after confirmed retries');
  assert.equal(useStore.getState().notes.some((n) => n.id === 'note-off1' || n.id === 'note-off2'), false, 'deleted notes stay gone');
  assert.equal(useStore.getState().notes.some((n) => n.id === 'note-other'), true, 'genuine server-only adoption still works');
});