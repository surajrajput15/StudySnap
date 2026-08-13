import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deferDelete,
  undoDelete,
  getPendingDelete,
  subscribeDeleteUndo,
} from '../lib/undo.ts';

// Day 9 Task 9 — a single-click delete is deferred for an undo window; the real
// deletion only runs if the user does not hit Undo. Timers live outside React.

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('deferring a delete registers a pending item without performing it yet', () => {
  undoDelete();
  let ran = 0;
  deferDelete('Note "A" deleted', () => { ran += 1; }, 1000);
  assert.equal(ran, 0);
  assert.deepEqual(getPendingDelete(), { id: 1, label: 'Note "A" deleted' });
  undoDelete();
});

test('the deferred deletion runs once the undo window expires', async () => {
  undoDelete();
  let ran = 0;
  deferDelete('Voice memo deleted', () => { ran += 1; }, 20);
  assert.equal(ran, 0);
  await wait(60);
  assert.equal(ran, 1);
  assert.equal(getPendingDelete(), null);
});

test('undo cancels the deletion without performing it', async () => {
  undoDelete();
  let ran = 0;
  deferDelete('Note "B" deleted', () => { ran += 1; }, 20);
  undoDelete();
  await wait(60);
  assert.equal(ran, 0);
  assert.equal(getPendingDelete(), null);
});

test('deferring a new delete closes the previous undo window', async () => {
  undoDelete();
  let ranA = 0;
  let ranB = 0;
  deferDelete('Note "A" deleted', () => { ranA += 1; }, 20);
  deferDelete('Note "B" deleted', () => { ranB += 1; }, 20);
  await wait(60);
  assert.equal(ranA, 0, 'first pending deletion must be cancelled');
  assert.equal(ranB, 1, 'second pending deletion must perform');
  assert.equal(getPendingDelete(), null);
});

test('subscribers are notified when a deletion is deferred or undone', () => {
  undoDelete();
  const seen: (string | null)[] = [];
  const unsubscribe = subscribeDeleteUndo(() => {
    seen.push(getPendingDelete()?.label ?? null);
  });

  deferDelete('Note "C" deleted', () => {}, 1000);
  assert.deepEqual(seen, ['Note "C" deleted']);

  undoDelete();
  assert.deepEqual(seen, ['Note "C" deleted', null]);

  deferDelete('Note "D" deleted', () => {}, 1000);
  undoDelete();

  unsubscribe();
  deferDelete('Note "E" deleted', () => {}, 1000);
  assert.deepEqual(
    seen,
    ['Note "C" deleted', null, 'Note "D" deleted', null],
    'no notification after unsubscribe',
  );
  undoDelete();
});

test('undo after the window expires is a no-op', async () => {
  undoDelete();
  let ran = 0;
  deferDelete('Note "F" deleted', () => { ran += 1; }, 15);
  await wait(40);
  assert.equal(ran, 1);
  undoDelete();
  assert.equal(getPendingDelete(), null);
});