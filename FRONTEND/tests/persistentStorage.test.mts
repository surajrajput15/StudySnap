import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestPersistentStorage } from '../lib/persistence.ts';

// Day 9 Task 10 — request persistent storage so a mobile browser does not
// evict the IndexedDB/localStorage backing the local-first store.

function makeStorage(opts: {
  alreadyPersisted?: boolean;
  persistResult?: boolean;
  persistThrows?: boolean;
} = {}) {
  const calls: string[] = [];
  const storage = {
    async persisted() {
      calls.push('persisted');
      return opts.alreadyPersisted ?? false;
    },
    async persist() {
      calls.push('persist');
      if (opts.persistThrows) throw new Error('boom');
      return opts.persistResult ?? true;
    },
    get calls() {
      return calls;
    },
  };
  return storage;
}

test('returns unsupported when no StorageManager exists', async () => {
  const result = await requestPersistentStorage({ storage: null as never });
  assert.deepEqual(result, { state: 'unsupported', persisted: false });
});

test('already-persistent storage is reported granted without re-persisting', async () => {
  const storage = makeStorage({ alreadyPersisted: true });
  const result = await requestPersistentStorage({ storage });
  assert.deepEqual(result, { state: 'granted', persisted: true });
  assert.deepEqual(storage.calls, ['persisted'], 'persist() must not be called');
});

test('a fresh grant resolves granted and calls persist once', async () => {
  const storage = makeStorage({ alreadyPersisted: false, persistResult: true });
  const result = await requestPersistentStorage({ storage });
  assert.deepEqual(result, { state: 'granted', persisted: true });
  assert.deepEqual(storage.calls, ['persisted', 'persist']);
});

test('a declined grant resolves denied', async () => {
  const storage = makeStorage({ alreadyPersisted: false, persistResult: false });
  const result = await requestPersistentStorage({ storage });
  assert.deepEqual(result, { state: 'denied', persisted: false });
  assert.deepEqual(storage.calls, ['persisted', 'persist']);
});

test('a throwing persist resolves denied without crashing', async () => {
  const storage = makeStorage({ alreadyPersisted: false, persistThrows: true });
  const result = await requestPersistentStorage({ storage });
  assert.deepEqual(result, { state: 'denied', persisted: false });
});

test('repeated requests are idempotent while the grant holds', async () => {
  const storage = makeStorage({ alreadyPersisted: true });
  const a = await requestPersistentStorage({ storage });
  const b = await requestPersistentStorage({ storage });
  assert.equal(a.state, 'granted');
  assert.equal(b.state, 'granted');
  assert.deepEqual(storage.calls, ['persisted', 'persisted']);
});