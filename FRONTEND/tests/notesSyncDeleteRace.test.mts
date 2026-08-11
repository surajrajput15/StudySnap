import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Note } from '../lib/store/useStore.ts';
import { switchStoreScopeForUser, useStore } from '../lib/store/useStore.ts';
import {
  upsertRemoteNote,
  deleteRemoteNote,
  syncNotesForUser,
  type ServerNoteRow,
} from '../lib/sync/notesSync.ts';

const NOW = '2026-08-11T10:00:00.000Z';
const LATER = '2026-08-11T10:00:05.000Z';
const TOMBSTONE_KEY_PREFIX = 'studysnap:tombstones';

function makeNote(id: string): Note {
  return {
    id,
    title: 'Title',
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
  // Ordered, manually-resolved fetch: every network request is recorded in the
  // real send order and resolved by the test, so the POST-vs-DELETE interleaving
  // is fully deterministic.
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

function sentDeletes(noteId: string): string[] {
  return requestLog.filter((r) => r.method === 'DELETE' && r.url.includes(noteId)).map((r) => r.url);
}

function sentPosts(noteId: string): string[] {
  return requestLog
    .filter((r) => r.method === 'POST' && (r.url.includes(noteId) || (r.body ?? '').includes(noteId)))
    .map((r) => r.url);
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

test('Scenario A — stale POST completing after a successful DELETE cannot resurrect the note', async () => {
  const noteA = makeNote('note-a-race');
  useStore.setState({ notes: [noteA] });

  const upsert = upsertRemoteNote(noteA, tokenFn);
  await flushMicrotasks();
  const postReq = takePending('POST', noteA.id);

  useStore.getState().deleteNote(noteA.id);
  const del = deleteRemoteNote(noteA.id, tokenFn);
  await flushMicrotasks();
  const delReq1 = takePending('DELETE', noteA.id);

  // DELETE#1 succeeds while the upsert is STILL pending -> the tombstone must be
  // held open so a competing sync cannot adopt a resurrected server row.
  delReq1.resolve({ success: true });
  await del;
  await flushMicrotasks();
  assert.ok(readTombstones('userA').has(noteA.id), 'tombstone held while an upsert is in flight');

  // Now the stale upsert completes. It must NOT recreate the note: it re-records
  // the tombstone and issues a compensating DELETE, and never touches state.
  postReq.resolve({ success: true, note: serverNote(noteA.id, LATER) });
  await flushMicrotasks();
  const compDelete = takePending('DELETE', noteA.id);
  compDelete.resolve({ success: true });
  await upsert;
  await flushMicrotasks();

  assert.equal(sentDeletes(noteA.id).length, 2, 'original DELETE + compensating DELETE');
  assert.equal(requestLog[requestLog.length - 1].method, 'DELETE', 'final network op must be a DELETE');
  assert.ok(requestLog[requestLog.length - 1].url.includes(noteA.id));
  assert.ok(!readTombstones('userA').has(noteA.id), 'tombstone cleared once compensated and upsert settled');
  assert.equal(useStore.getState().notes.some((n) => n.id === noteA.id), false, 'note never returns to the store');
});

test('Scenario B — POST resolves before the DELETE resolves; final state remains deleted', async () => {
  const noteB = makeNote('note-b-race');
  useStore.setState({ notes: [noteB] });

  const upsert = upsertRemoteNote(noteB, tokenFn);
  await flushMicrotasks();
  const postReq = takePending('POST', noteB.id);

  useStore.getState().deleteNote(noteB.id);
  const del = deleteRemoteNote(noteB.id, tokenFn);
  await flushMicrotasks();
  const delReq1 = takePending('DELETE', noteB.id);

  // Resolve the stale POST FIRST, while the DELETE is still in flight.
  postReq.resolve({ success: true, note: serverNote(noteB.id, LATER) });
  await flushMicrotasks();
  assert.equal(useStore.getState().notes.some((n) => n.id === noteB.id), false);
  assert.ok(readTombstones('userA').has(noteB.id), 'tombstone intact after stale POST');

  // DELETE#1 resolves second. A compensating DELETE must already be queued
  // behind it on the promise chain, so DELETE#1 must NOT clear the tombstone.
  delReq1.resolve({ success: true });
  await del;
  await flushMicrotasks();
  assert.ok(readTombstones('userA').has(noteB.id), 'tombstone held until the compensating DELETE runs');
  const delReq2 = takePending('DELETE', noteB.id);

  delReq2.resolve({ success: true });
  await flushMicrotasks();
  await upsert;

  assert.equal(sentDeletes(noteB.id).length, 2, 'original + compensating DELETE');
  assert.equal(requestLog[requestLog.length - 1].method, 'DELETE', 'final network op must be a DELETE');
  assert.ok(!readTombstones('userA').has(noteB.id), 'tombstone cleared after the final DELETE');
  assert.equal(useStore.getState().notes.some((n) => n.id === noteB.id), false);
});

test('Scenario C — offline delete survives reconnect; flush DELETE cleans the server; nothing re-seeds', async () => {
  const noteC = makeNote('note-c-offline');
  useStore.setState({ notes: [noteC] });

  setOnline(false);
  useStore.getState().deleteNote(noteC.id);
  const delOffline = deleteRemoteNote(noteC.id, tokenFn);
  await flushMicrotasks();
  await delOffline;

  assert.equal(sentDeletes(noteC.id).length, 0, 'offline delete issues no request');
  assert.ok(readTombstones('userA').has(noteC.id), 'tombstone recorded immediately offline');
  assert.equal(useStore.getState().notes.some((n) => n.id === noteC.id), false);

  // Reconnect -> hydration retries the remote DELETE before adopting server rows.
  setOnline(true);
  const sync = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const delReq = takePending('DELETE', noteC.id);
  delReq.resolve({ success: true });
  await flushMicrotasks();

  const getReq = takePending('GET', '');
  getReq.resolve({ success: true, notes: [] }); // server already has nothing for the deleted note
  await sync;
  await flushMicrotasks();

  assert.ok(!readTombstones('userA').has(noteC.id), 'tombstone cleared after confirmed DELETE');
  assert.equal(sentPosts(noteC.id).length, 0, 'deleted note is never re-seeded');
  assert.equal(useStore.getState().notes.some((n) => n.id === noteC.id), false);
});

test('Scenario D — Account A stale upsert cannot affect Account B', async () => {
  const shared = makeNote('note-shared-id');
  useStore.setState({ notes: [shared] });

  // Account A starts an in-flight upsert for the note.
  const upsertA = upsertRemoteNote(shared, tokenFn);
  await flushMicrotasks();
  const postA = takePending('POST', shared.id);

  // Switch to Account B mid-flight; B deletes the same note id.
  switchStoreScopeForUser('userB');
  useStore.getState().deleteNote(shared.id);
  const delB = deleteRemoteNote(shared.id, tokenFn);
  await flushMicrotasks();
  const delReqB = takePending('DELETE', shared.id);
  delReqB.resolve({ success: true });
  await delB;

  // A's POST completes AFTER the switch. Its captured scope is Account A, which
  // no longer matches, so it must abort WITHOUT a compensating delete or any
  // write under B.
  postA.resolve({ success: true, note: serverNote(shared.id, LATER) });
  await upsertA;
  await flushMicrotasks();

  assert.equal(sentDeletes(shared.id).length, 1, "only Account B's own DELETE - no cross-account compensation");
  assert.ok(!readTombstones('userB').has(shared.id), "Account B's tombstone cleared normally");
  assert.ok(!readTombstones('userA').has(shared.id), "Account A's tombstone namespace untouched");
  assert.equal(useStore.getState().notes.some((n) => n.id === shared.id), false, 'scoped to B: nothing resurrected');
});

test('Scenario E — normal edit -> autosave upsert reaches the server untouched', async () => {
  const noteE = makeNote('note-e-normal');
  useStore.setState({ notes: [noteE] });

  const upsert = upsertRemoteNote(noteE, tokenFn);
  await flushMicrotasks();
  const postReq = takePending('POST', noteE.id);
  postReq.resolve({ success: true, note: serverNote(noteE.id, LATER) });
  await upsert;
  await flushMicrotasks();

  assert.equal(sentPosts(noteE.id).length, 1, 'exactly one POST for the live note');
  assert.equal(sentDeletes(noteE.id).length, 0, 'no delete interference for a live note');
  const local = useStore.getState().notes.find((n) => n.id === noteE.id);
  assert.ok(local, 'note remains in the store');
  assert.equal(local.updatedAt, LATER, 'server clock adopted for a live note');
  assert.ok(!readTombstones('userA').has(noteE.id));
});

test('Repeated delete attempts — double deleteRemoteNote serializes and clears only once', async () => {
  const noteR = makeNote('note-r-repeat');
  useStore.setState({ notes: [noteR] });
  useStore.getState().deleteNote(noteR.id);

  const d1 = deleteRemoteNote(noteR.id, tokenFn);
  await flushMicrotasks();
  const d2 = deleteRemoteNote(noteR.id, tokenFn);
  await flushMicrotasks();

  const delReq1 = takePending('DELETE', noteR.id);
  delReq1.resolve({ success: true });
  await flushMicrotasks();

  const delReq2 = takePending('DELETE', noteR.id);
  delReq2.resolve({ success: true });
  await Promise.all([d1, d2]);
  await flushMicrotasks();

  assert.equal(sentDeletes(noteR.id).length, 2, 'both delete attempts sent, serialized');
  assert.ok(!readTombstones('userA').has(noteR.id), 'tombstone cleared exactly once at the end');
  assert.equal(useStore.getState().notes.some((n) => n.id === noteR.id), false);
});