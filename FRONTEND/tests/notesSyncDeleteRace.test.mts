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

test('Scenario F1 — hydration merge cannot clobber a note edited while the merge waits on the network', async () => {
  // Force the MERGE path (not the one-time seed): sync flag already set + empty
  // server store, so every local note is uploaded through guardedUpsert.
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const OLD = '2020-01-01T00:00:00.000Z';
  const noteF1 = {
    ...makeNote('note-f1-edit'),
    content: '<p>Older K</p>',
    updatedAt: OLD,
    createdAt: OLD,
  };
  useStore.setState({ notes: [noteF1] });

  const sync = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq = takePending('GET', '');
  getReq.resolve({ success: true, notes: [] });
  await flushMicrotasks();
  const postReq = takePending('POST', noteF1.id);

  // Autosave commits NEWER local content while the merge's own POST is pending.
  useStore.getState().updateNote(noteF1.id, { content: '<p>Newer K2</p>' });
  const edited = useStore.getState().notes.find((n) => n.id === noteF1.id);
  assert.ok(edited);
  const newerUpdatedAt = edited.updatedAt;

  // Resolve the merge's stale POST (server row is not newer than the edit).
  postReq.resolve({ success: true, note: serverNote(noteF1.id, OLD) });
  await sync;
  await flushMicrotasks();

  const after = useStore.getState().notes.find((n) => n.id === noteF1.id);
  assert.ok(after, 'note remains present');
  assert.equal(after.content, '<p>Newer K2</p>', 'concurrent edit content is never rolled back');
  assert.equal(after.updatedAt, newerUpdatedAt, 'concurrent edit timestamp is retained');
});

test('Scenario F2 — a note created while the merge is pending is not dropped or duplicated', async () => {
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const OLD = '2020-01-01T00:00:00.000Z';
  const noteF2 = {
    ...makeNote('note-f2-create'),
    content: '<p>Existing</p>',
    updatedAt: OLD,
    createdAt: OLD,
  };
  useStore.setState({ notes: [noteF2] });

  const sync = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq = takePending('GET', '');
  getReq.resolve({ success: true, notes: [] });
  await flushMicrotasks();
  const postReq = takePending('POST', noteF2.id);

  // A brand-new note is created while the merge POST is still pending.
  const fresh = useStore.getState().addNote({
    title: 'Fresh',
    content: '<p>new</p>',
    tags: [],
    isPinned: false,
    isFavorite: false,
    pinLock: null,
    categoryId: null,
    folderId: null,
  });

  postReq.resolve({ success: true, note: serverNote(noteF2.id, OLD) });
  await sync;
  await flushMicrotasks();

  assert.ok(useStore.getState().notes.some((n) => n.id === fresh.id), 'note created during the merge survives');
  assert.equal(useStore.getState().notes.filter((n) => n.id === fresh.id).length, 1, 'no duplicate id introduced');
  assert.ok(useStore.getState().notes.some((n) => n.id === noteF2.id), 'original note still present');
});

test('Scenario F3 — normal hydration still adopts the newer server row when nothing changed locally', async () => {
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const OLD = '2020-01-01T00:00:00.000Z';
  const NEWER = '2099-01-01T00:00:00.000Z';
  const noteF3 = {
    ...makeNote('note-f3-normal'),
    content: '<p>Local body</p>',
    updatedAt: OLD,
    createdAt: OLD,
  };
  useStore.setState({ notes: [noteF3] });

  const sync = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq = takePending('GET', '');
  getReq.resolve({ success: true, notes: [{ ...serverNote(noteF3.id, NEWER), content: '<p>Server body</p>' }] });
  await sync;
  await flushMicrotasks();

  const after = useStore.getState().notes.find((n) => n.id === noteF3.id);
  assert.ok(after, 'note remains present');
  assert.equal(after.content, '<p>Server body</p>', 'server row wins when its updatedAt is newer');
  assert.equal(after.updatedAt, NEWER, 'server timestamp adopted');
});

test('G1 — offline edit pushed on reconnect', async () => {
  // Sync flag set → the MERGE path runs; the note exists on BOTH sides with the
  // local copy strictly newer (an offline edit) and a changed payload.
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const SERVER_OLD = '2019-01-01T00:00:00.000Z';
  const LOCAL_NEWER = '2020-01-01T00:00:00.000Z';
  const ADOPTED = '2021-01-01T00:00:00.000Z';
  const noteG1 = {
    ...makeNote('note-g1-push'),
    content: '<p>Newer offline content</p>',
    updatedAt: LOCAL_NEWER,
    createdAt: LOCAL_NEWER,
  };
  useStore.setState({ notes: [noteG1] });

  const sync = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq = takePending('GET', '');
  getReq.resolve({
    success: true,
    notes: [{ ...serverNote(noteG1.id, SERVER_OLD), content: '<p>Old server content</p>' }],
  });
  await flushMicrotasks();

  // The reconnect push must be a single POST carrying the newer local content.
  const postReq = takePending('POST', noteG1.id);
  const body = JSON.parse(postReq.body ?? '{}') as { content: string };
  assert.equal(body.content, '<p>Newer offline content</p>', 'POST body carries the newer local content');

  postReq.resolve({ success: true, note: { ...serverNote(noteG1.id, ADOPTED), content: '<p>Newer offline content</p>' } });
  await sync;
  await flushMicrotasks();

  assert.equal(sentPosts(noteG1.id).length, 1, 'exactly one POST for the offline-edited note');
  assert.equal(sentDeletes(noteG1.id).length, 0, 'no delete interference');
  const after = useStore.getState().notes.find((n) => n.id === noteG1.id);
  assert.ok(after, 'note remains present');
  assert.equal(after.content, '<p>Newer offline content</p>', 'newer local content retained');
  assert.equal(after.updatedAt, ADOPTED, 'server clock adopted for the successfully pushed note');
  assert.ok(!readTombstones('userA').has(noteG1.id), 'no tombstone for a live note');
});

test('G2 — failed reconnect upload is retryable', async () => {
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const SERVER_OLD = '2019-01-01T00:00:00.000Z';
  const LOCAL_NEWER = '2020-01-01T00:00:00.000Z';
  const ADOPTED = '2021-01-01T00:00:00.000Z';
  const noteG2 = {
    ...makeNote('note-g2-retry'),
    content: '<p>Offline edit v2</p>',
    updatedAt: LOCAL_NEWER,
    createdAt: LOCAL_NEWER,
  };
  useStore.setState({ notes: [noteG2] });

  // First reconnect: the POST fails. The newer local note must survive intact.
  const sync1 = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq1 = takePending('GET', '');
  getReq1.resolve({
    success: true,
    notes: [{ ...serverNote(noteG2.id, SERVER_OLD), content: '<p>Old server content</p>' }],
  });
  await flushMicrotasks();
  const postReq1 = takePending('POST', noteG2.id);
  const body1 = JSON.parse(postReq1.body ?? '{}') as { content: string };
  assert.equal(body1.content, '<p>Offline edit v2</p>');
  postReq1.resolve({ success: false });
  await sync1;
  await flushMicrotasks();

  let after = useStore.getState().notes.find((n) => n.id === noteG2.id);
  assert.ok(after, 'newer local note retained after a failed upload');
  assert.equal(after.content, '<p>Offline edit v2</p>', 'content untouched by the failed POST');
  assert.equal(after.updatedAt, LOCAL_NEWER, 'timestamp untouched by the failed POST');

  // Second reconnect retries the same upload.
  const sync2 = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq2 = takePending('GET', '');
  getReq2.resolve({
    success: true,
    notes: [{ ...serverNote(noteG2.id, SERVER_OLD), content: '<p>Old server content</p>' }],
  });
  await flushMicrotasks();
  const postReq2 = takePending('POST', noteG2.id);
  const body2 = JSON.parse(postReq2.body ?? '{}') as { content: string };
  assert.equal(body2.content, '<p>Offline edit v2</p>', 'retry POST carries the same newer content');
  postReq2.resolve({ success: true, note: { ...serverNote(noteG2.id, ADOPTED), content: '<p>Offline edit v2</p>' } });
  await sync2;
  await flushMicrotasks();

  assert.equal(sentPosts(noteG2.id).length, 2, 'first POST failed, second POST retried');
  after = useStore.getState().notes.find((n) => n.id === noteG2.id);
  assert.ok(after);
  assert.equal(after.content, '<p>Offline edit v2</p>');
});

test('G3 — no ping-pong after successful reconnect', async () => {
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const SERVER_OLD = '2019-01-01T00:00:00.000Z';
  const LOCAL_NEWER = '2020-01-01T00:00:00.000Z';
  const ADOPTED = '2021-01-01T00:00:00.000Z';
  const noteG3 = {
    ...makeNote('note-g3-noping'),
    content: '<p>Synced body</p>',
    updatedAt: LOCAL_NEWER,
    createdAt: LOCAL_NEWER,
  };
  useStore.setState({ notes: [noteG3] });

  // First sync pushes the newer local note and adopts the server clock.
  const sync1 = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq1 = takePending('GET', '');
  getReq1.resolve({ success: true, notes: [{ ...serverNote(noteG3.id, SERVER_OLD), content: '<p>Old server content</p>' }] });
  await flushMicrotasks();
  const postReq1 = takePending('POST', noteG3.id);
  postReq1.resolve({ success: true, note: { ...serverNote(noteG3.id, ADOPTED), content: '<p>Synced body</p>' } });
  await sync1;
  await flushMicrotasks();
  assert.equal(sentPosts(noteG3.id).length, 1, 'one POST on the first sync');
  const adopted = useStore.getState().notes.find((n) => n.id === noteG3.id);
  assert.ok(adopted);
  assert.equal(adopted.updatedAt, ADOPTED, 'server clock adopted, local no longer newer');

  // Second sync: server copy is now as new as the local copy → nothing to push.
  const sync2 = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq2 = takePending('GET', '');
  getReq2.resolve({ success: true, notes: [{ ...serverNote(noteG3.id, ADOPTED), content: '<p>Synced body</p>' }] });
  await sync2;
  await flushMicrotasks();
  assert.equal(sentPosts(noteG3.id).length, 1, 'no ping-pong POST after adoption');
});

test('G4 — delete vs reconnect push race: delete wins, nothing resurrects', async () => {
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const SERVER_OLD = '2019-01-01T00:00:00.000Z';
  const LOCAL_NEWER = '2020-01-01T00:00:00.000Z';
  const noteG4 = {
    ...makeNote('note-g4-race'),
    content: '<p>Local v2</p>',
    updatedAt: LOCAL_NEWER,
    createdAt: LOCAL_NEWER,
  };
  useStore.setState({ notes: [noteG4] });

  const sync = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq = takePending('GET', '');
  getReq.resolve({ success: true, notes: [{ ...serverNote(noteG4.id, SERVER_OLD), content: '<p>Old server content</p>' }] });
  await flushMicrotasks();

  // The reconnect push POST is now in flight.
  const postReq = takePending('POST', noteG4.id);

  // Delete happens while the push is in flight → tombstone + epoch bump + DELETE.
  useStore.getState().deleteNote(noteG4.id);
  const del = deleteRemoteNote(noteG4.id, tokenFn);
  await flushMicrotasks();
  const delReq1 = takePending('DELETE', noteG4.id);

  // The stale push POST completes AFTER the delete. Task 2 must compensate:
  // epoch mismatch + tombstone → never re-insert the note.
  postReq.resolve({ success: true, note: { ...serverNote(noteG4.id, '2099-01-01T00:00:00.000Z'), content: '<p>Local v2</p>' } });
  await flushMicrotasks();

  // Compensating DELETE is queued behind the in-flight DELETE#1.
  delReq1.resolve({ success: true });
  await del;
  await flushMicrotasks();
  const compDelete = takePending('DELETE', noteG4.id);
  compDelete.resolve({ success: true });

  await sync;
  await flushMicrotasks();

  assert.equal(sentPosts(noteG4.id).length, 1, 'the reconnect push POST was sent once');
  assert.equal(sentDeletes(noteG4.id).length, 2, 'original DELETE + compensating DELETE');
  assert.equal(requestLog[requestLog.length - 1].method, 'DELETE', 'final network op must be a DELETE');
  assert.ok(requestLog[requestLog.length - 1].url.includes(noteG4.id));
  assert.ok(!readTombstones('userA').has(noteG4.id), 'tombstone cleared after the confirmed final DELETE');
  assert.equal(useStore.getState().notes.some((n) => n.id === noteG4.id), false, 'no resurrection into the store');
});

test('G5 — newer local edit during reconnect push is never overwritten', async () => {
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const SERVER_OLD = '2019-01-01T00:00:00.000Z';
  const SNAPSHOT = '2020-01-01T00:00:00.000Z';
  const noteG5 = {
    ...makeNote('note-g5-edit'),
    content: '<p>K2</p>',
    updatedAt: SNAPSHOT,
    createdAt: SNAPSHOT,
  };
  useStore.setState({ notes: [noteG5] });

  const sync = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq = takePending('GET', '');
  getReq.resolve({ success: true, notes: [{ ...serverNote(noteG5.id, SERVER_OLD), content: '<p>Old server content</p>' }] });
  await flushMicrotasks();
  const postReq = takePending('POST', noteG5.id);
  const body = JSON.parse(postReq.body ?? '{}') as { content: string };
  assert.equal(body.content, '<p>K2</p>', 'push POST starts with the K2 snapshot');

  // While the push POST is pending, the user makes a NEWER local edit (K3).
  useStore.getState().updateNote(noteG5.id, { content: '<p>K3</p>' });
  const edited = useStore.getState().notes.find((n) => n.id === noteG5.id)!;
  assert.equal(edited.content, '<p>K3</p>');
  const newerTs = edited.updatedAt;
  assert.ok(new Date(newerTs).getTime() > new Date(SNAPSHOT).getTime(), 'K3 is strictly newer than the K2 snapshot');

  // The K2 POST resolves; the commit must keep K3 — never roll back to K2.
  postReq.resolve({ success: true, note: { ...serverNote(noteG5.id, '2099-01-01T00:00:00.000Z'), content: '<p>K2</p>' } });
  await sync;
  await flushMicrotasks();

  const after = useStore.getState().notes.find((n) => n.id === noteG5.id);
  assert.ok(after, 'note remains present');
  assert.equal(after.content, '<p>K3</p>', 'newer local edit K3 is never overwritten by the stale K2 push');
  assert.equal(after.updatedAt, newerTs, 'K3 timestamp retained');
  assert.equal(sentPosts(noteG5.id).length, 1, 'only the K2 snapshot was pushed by the merge');
});

test('G6 — server-only note is adopted into the local store', async () => {
  // Merge path: server already has rows, so the one-time seed is bypassed.
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const serverOnlyId = 'note-g6-server-only';
  useStore.setState({ notes: [] });

  const sync = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq = takePending('GET', '');
  getReq.resolve({
    success: true,
    notes: [{ ...serverNote(serverOnlyId, LATER), content: '<p>Server-only body</p>' }],
  });
  await sync;
  await flushMicrotasks();

  const after = useStore.getState().notes.find((n) => n.id === serverOnlyId);
  assert.ok(after, 'server-only note MUST be adopted into the local store');
  assert.equal(after.content, '<p>Server-only body</p>', 'server content preserved');
  assert.equal(after.updatedAt, LATER, 'server timestamp adopted');
  assert.equal(useStore.getState().notes.filter((n) => n.id === serverOnlyId).length, 1, 'no duplicate id');
  assert.equal(sentPosts(serverOnlyId).length, 0, 'server-only adoption issues no POST');
  assert.equal(sentDeletes(serverOnlyId).length, 0, 'no delete interference');
});

test('G6b — server-only note is adopted alongside existing local notes', async () => {
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const localId = 'note-g6-local';
  const serverOnlyId = 'note-g6b-server-only';
  useStore.setState({ notes: [makeNote(localId)] });

  const sync = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq = takePending('GET', '');
  getReq.resolve({
    success: true,
    notes: [
      { ...serverNote(localId, NOW), content: '<p>Body</p>' },
      { ...serverNote(serverOnlyId, LATER), content: '<p>Server-only body</p>' },
    ],
  });
  await sync;
  await flushMicrotasks();

  assert.ok(useStore.getState().notes.some((n) => n.id === localId), 'existing local note untouched');
  const after = useStore.getState().notes.find((n) => n.id === serverOnlyId);
  assert.ok(after, 'server-only note adopted alongside local notes');
  assert.equal(after.content, '<p>Server-only body</p>');
});

test('G7 — tombstoned server-only note is never resurrected', async () => {
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const noteId = 'note-g7-deleted';
  // A previously-deleted note: the tombstone exists locally, but the server still
  // holds the row (the compensating DELETE has not succeeded yet).
  g.window.localStorage.setItem(`${TOMBSTONE_KEY_PREFIX}:userA`, JSON.stringify([noteId]));
  useStore.setState({ notes: [] });

  const sync = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  // flushPendingDeletes retries the failed DELETE first; it fails again, so the
  // tombstone must stay intact for the merge below.
  const delReq = takePending('DELETE', noteId);
  delReq.resolve({ success: false });
  await flushMicrotasks();
  assert.ok(readTombstones('userA').has(noteId), 'tombstone retained after a failed DELETE retry');

  const getReq = takePending('GET', '');
  getReq.resolve({ success: true, notes: [{ ...serverNote(noteId, LATER), content: '<p>Server body</p>' }] });
  await sync;
  await flushMicrotasks();

  assert.equal(useStore.getState().notes.some((n) => n.id === noteId), false, 'tombstoned note never adopted');
  assert.ok(readTombstones('userA').has(noteId), 'tombstone behavior intact');
  assert.equal(sentPosts(noteId).length, 0, 'tombstoned note never re-seeded');
});

test('G8 — K3 survives the K2 in-flight upload and is uploaded on the next sync', async () => {
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const SERVER_OLD = '2019-01-01T00:00:00.000Z';
  const SNAPSHOT = '2020-01-01T00:00:00.000Z';
  // The server processes the stale K2 upload AFTER the K3 edit, so it stamps the
  // row with a clock NEWER than K3 (realistic when clocks are in sync).
  const K2_SERVER = '2099-01-01T00:00:00.000Z';
  const K3_ADOPTED = '2099-01-01T00:00:01.000Z';
  const noteG8 = {
    ...makeNote('note-g8-k3'),
    content: '<p>K2</p>',
    updatedAt: SNAPSHOT,
    createdAt: SNAPSHOT,
  };
  useStore.setState({ notes: [noteG8] });

  // Sync 1 — reconnect push of the K2 snapshot; K3 is edited while it is in flight.
  const sync1 = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq1 = takePending('GET', '');
  getReq1.resolve({ success: true, notes: [{ ...serverNote(noteG8.id, SERVER_OLD), content: '<p>Old server content</p>' }] });
  await flushMicrotasks();
  const postReq1 = takePending('POST', noteG8.id);
  assert.equal(JSON.parse(postReq1.body ?? '{}').content, '<p>K2</p>', 'sync 1 pushes the K2 snapshot');

  useStore.getState().updateNote(noteG8.id, { content: '<p>K3</p>' });
  const edited = useStore.getState().notes.find((n) => n.id === noteG8.id)!;
  const newerTs = edited.updatedAt;
  assert.ok(new Date(newerTs).getTime() > new Date(SNAPSHOT).getTime(), 'K3 strictly newer than the K2 snapshot');

  postReq1.resolve({ success: true, note: { ...serverNote(noteG8.id, K2_SERVER), content: '<p>K2</p>' } });
  await sync1;
  await flushMicrotasks();

  let after = useStore.getState().notes.find((n) => n.id === noteG8.id);
  assert.ok(after, 'note remains present after sync 1');
  assert.equal(after.content, '<p>K3</p>', 'K3 survives the stale K2 push');
  assert.equal(after.updatedAt, newerTs, 'K3 timestamp retained after sync 1');

  // Sync 2 — the server still holds stale K2 with a newer clock. The merge must
  // recognize K3 as the genuine winner and push it.
  const sync2 = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq2 = takePending('GET', '');
  getReq2.resolve({ success: true, notes: [{ ...serverNote(noteG8.id, K2_SERVER), content: '<p>K2</p>' }] });
  await flushMicrotasks();
  const postReq2 = takePending('POST', noteG8.id);
  const body2 = JSON.parse(postReq2.body ?? '{}') as { content: string };
  assert.equal(body2.content, '<p>K3</p>', 'sync 2 uploads the newer K3 content');

  postReq2.resolve({ success: true, note: { ...serverNote(noteG8.id, K3_ADOPTED), content: '<p>K3</p>' } });
  await sync2;
  await flushMicrotasks();

  after = useStore.getState().notes.find((n) => n.id === noteG8.id);
  assert.ok(after, 'note remains present after sync 2');
  assert.equal(after.content, '<p>K3</p>', 'K3 still present after adoption');
  assert.equal(after.updatedAt, K3_ADOPTED, 'server clock for K3 adopted');
  assert.equal(sentPosts(noteG8.id).length, 2, 'exactly K2 then K3 were pushed');
});

test('G8b — a failed K3 upload on the supersede path is retried without rollback or ping-pong', async () => {
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const SERVER_OLD = '2019-01-01T00:00:00.000Z';
  const SNAPSHOT = '2020-01-01T00:00:00.000Z';
  const K2_SERVER = '2099-01-01T00:00:00.000Z';
  const K3_ADOPTED = '2099-01-01T00:00:01.000Z';
  const noteG8b = {
    ...makeNote('note-g8b-retry'),
    content: '<p>K2</p>',
    updatedAt: SNAPSHOT,
    createdAt: SNAPSHOT,
  };
  useStore.setState({ notes: [noteG8b] });

  // Sync 1 — the usual K2-push-while-edited-to-K3 setup; K3 wins locally.
  const sync1 = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq1 = takePending('GET', '');
  getReq1.resolve({ success: true, notes: [{ ...serverNote(noteG8b.id, SERVER_OLD), content: '<p>Old server content</p>' }] });
  await flushMicrotasks();
  const postReq1 = takePending('POST', noteG8b.id);
  useStore.getState().updateNote(noteG8b.id, { content: '<p>K3</p>' });
  const newerTs = useStore.getState().notes.find((n) => n.id === noteG8b.id)!.updatedAt;
  postReq1.resolve({ success: true, note: { ...serverNote(noteG8b.id, K2_SERVER), content: '<p>K2</p>' } });
  await sync1;
  await flushMicrotasks();
  assert.equal(useStore.getState().notes.find((n) => n.id === noteG8b.id)?.content, '<p>K3</p>');

  // Sync 2 — the K3 upload FAILS. K3 must survive with its own clock and the
  // supersede record must persist for a later retry (no false server-clock
  // adoption, no rollback).
  const sync2 = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq2 = takePending('GET', '');
  getReq2.resolve({ success: true, notes: [{ ...serverNote(noteG8b.id, K2_SERVER), content: '<p>K2</p>' }] });
  await flushMicrotasks();
  const postReq2 = takePending('POST', noteG8b.id);
  assert.equal(JSON.parse(postReq2.body ?? '{}').content, '<p>K3</p>', 'sync 2 retries the K3 upload');
  postReq2.resolve({ success: false });
  await sync2;
  await flushMicrotasks();
  let after = useStore.getState().notes.find((n) => n.id === noteG8b.id);
  assert.ok(after, 'note present after the failed K3 upload');
  assert.equal(after.content, '<p>K3</p>', 'K3 content retained after a failed upload');
  assert.equal(after.updatedAt, newerTs, 'no false server-clock adoption after a failed upload');

  // Sync 3 — the supersede record still wins: K3 is uploaded again and its
  // server clock is adopted.
  const sync3 = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq3 = takePending('GET', '');
  getReq3.resolve({ success: true, notes: [{ ...serverNote(noteG8b.id, K2_SERVER), content: '<p>K2</p>' }] });
  await flushMicrotasks();
  const postReq3 = takePending('POST', noteG8b.id);
  postReq3.resolve({ success: true, note: { ...serverNote(noteG8b.id, K3_ADOPTED), content: '<p>K3</p>' } });
  await sync3;
  await flushMicrotasks();
  after = useStore.getState().notes.find((n) => n.id === noteG8b.id);
  assert.equal(after?.updatedAt, K3_ADOPTED, 'K3 clock adopted on the successful retry');

  // Sync 4 — server and local agree: no further POST.
  const sync4 = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq4 = takePending('GET', '');
  getReq4.resolve({ success: true, notes: [{ ...serverNote(noteG8b.id, K3_ADOPTED), content: '<p>K3</p>' }] });
  await sync4;
  await flushMicrotasks();
  assert.equal(sentPosts(noteG8b.id).length, 3, 'K2 + failed K3 + successful K3 — no ping-pong POST');
});

test('G9 — no ping-pong after K3 adoption', async () => {
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const SERVER_OLD = '2019-01-01T00:00:00.000Z';
  const SNAPSHOT = '2020-01-01T00:00:00.000Z';
  const K2_SERVER = '2099-01-01T00:00:00.000Z';
  const K3_ADOPTED = '2099-01-01T00:00:01.000Z';
  const noteG9 = {
    ...makeNote('note-g9-noping'),
    content: '<p>K2</p>',
    updatedAt: SNAPSHOT,
    createdAt: SNAPSHOT,
  };
  useStore.setState({ notes: [noteG9] });

  // Sync 1 — K2 push held, K3 edited, K2 resolves with a newer server clock.
  const sync1 = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq1 = takePending('GET', '');
  getReq1.resolve({ success: true, notes: [{ ...serverNote(noteG9.id, SERVER_OLD), content: '<p>Old server content</p>' }] });
  await flushMicrotasks();
  const postReq1 = takePending('POST', noteG9.id);
  useStore.getState().updateNote(noteG9.id, { content: '<p>K3</p>' });
  postReq1.resolve({ success: true, note: { ...serverNote(noteG9.id, K2_SERVER), content: '<p>K2</p>' } });
  await sync1;
  await flushMicrotasks();
  assert.equal(useStore.getState().notes.find((n) => n.id === noteG9.id)?.content, '<p>K3</p>');

  // Sync 2 — K3 is uploaded and its server clock adopted.
  const sync2 = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq2 = takePending('GET', '');
  getReq2.resolve({ success: true, notes: [{ ...serverNote(noteG9.id, K2_SERVER), content: '<p>K2</p>' }] });
  await flushMicrotasks();
  const postReq2 = takePending('POST', noteG9.id);
  postReq2.resolve({ success: true, note: { ...serverNote(noteG9.id, K3_ADOPTED), content: '<p>K3</p>' } });
  await sync2;
  await flushMicrotasks();
  assert.equal(useStore.getState().notes.find((n) => n.id === noteG9.id)?.updatedAt, K3_ADOPTED, 'K3 server clock adopted');

  // Sync 3 — server and local are identical now: nothing may be re-uploaded.
  const sync3 = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq3 = takePending('GET', '');
  getReq3.resolve({ success: true, notes: [{ ...serverNote(noteG9.id, K3_ADOPTED), content: '<p>K3</p>' }] });
  await sync3;
  await flushMicrotasks();

  const after = useStore.getState().notes.find((n) => n.id === noteG9.id);
  assert.ok(after, 'note present after sync 3');
  assert.equal(after.content, '<p>K3</p>');
  assert.equal(after.updatedAt, K3_ADOPTED, 'adopted clock retained');
  assert.equal(sentPosts(noteG9.id).length, 2, 'no unnecessary POST after K3 adoption');
});

test('G10 — delete vs reconnect push race: compensating DELETE wins, nothing resurrects', async () => {
  g.window.localStorage.setItem('studysnap:notes-synced:userA', '1');
  const SERVER_OLD = '2019-01-01T00:00:00.000Z';
  const SNAPSHOT = '2020-01-01T00:00:00.000Z';
  const noteG10 = {
    ...makeNote('note-g10-race'),
    content: '<p>K2</p>',
    updatedAt: SNAPSHOT,
    createdAt: SNAPSHOT,
  };
  useStore.setState({ notes: [noteG10] });

  const sync = syncNotesForUser('userA', tokenFn);
  await flushMicrotasks();
  const getReq = takePending('GET', '');
  getReq.resolve({ success: true, notes: [{ ...serverNote(noteG10.id, SERVER_OLD), content: '<p>Old server content</p>' }] });
  await flushMicrotasks();
  const postReq = takePending('POST', noteG10.id);

  // Delete happens while the reconnect push POST is in flight.
  useStore.getState().deleteNote(noteG10.id);
  const del = deleteRemoteNote(noteG10.id, tokenFn);
  await flushMicrotasks();
  const delReq1 = takePending('DELETE', noteG10.id);

  // The stale POST resolves FIRST; Task 2 must compensate with a DELETE queued
  // behind the in-flight DELETE#1, and never let the note back into state.
  postReq.resolve({ success: true, note: { ...serverNote(noteG10.id, '2099-01-01T00:00:00.000Z'), content: '<p>K2</p>' } });
  await flushMicrotasks();

  delReq1.resolve({ success: true });
  await del;
  await flushMicrotasks();
  const compDelete = takePending('DELETE', noteG10.id);
  compDelete.resolve({ success: true });

  await sync;
  await flushMicrotasks();

  assert.equal(sentPosts(noteG10.id).length, 1, 'the reconnect push POST was sent once');
  assert.equal(sentDeletes(noteG10.id).length, 2, 'original DELETE + compensating DELETE');
  assert.equal(requestLog[requestLog.length - 1].method, 'DELETE', 'final network op must be a DELETE');
  assert.ok(requestLog[requestLog.length - 1].url.includes(noteG10.id));
  assert.ok(!readTombstones('userA').has(noteG10.id), 'tombstone cleared after the confirmed compensating DELETE');
  assert.equal(useStore.getState().notes.some((n) => n.id === noteG10.id), false, 'no resurrection into the store');
});