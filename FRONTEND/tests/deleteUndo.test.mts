import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deferDelete,
  undoDelete,
  getPendingDelete,
  subscribeDeleteUndo,
  cancelPendingDeleteFor,
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

test('deferring a new delete keeps the earlier one in its own undo window', async () => {
  undoDelete();
  undoDelete();
  let ranA = 0;
  let ranB = 0;
  deferDelete('Note "A" deleted', () => { ranA += 1; }, 20);
  deferDelete('Note "B" deleted', () => { ranB += 1; }, 20);
  assert.equal(ranA, 0, 'earlier pending deletion must NOT fire early');
  assert.equal(getPendingDelete()?.label, 'Note "B" deleted', 'toast shows the latest');
  await wait(60);
  assert.equal(ranA, 1, 'earlier pending deletion fires on its own timer');
  assert.equal(ranB, 1, 'second pending deletion must perform');
  assert.equal(getPendingDelete(), null);
});

test('undo cancels only the latest pending deletion', async () => {
  undoDelete();
  undoDelete();
  let ranA = 0;
  let ranB = 0;
  deferDelete('Note "A" deleted', () => { ranA += 1; }, 30);
  deferDelete('Note "B" deleted', () => { ranB += 1; }, 30);
  undoDelete();
  assert.equal(getPendingDelete()?.label, 'Note "A" deleted', 'toast falls back to earlier item');
  await wait(80);
  assert.equal(ranB, 0, 'undone deletion must not perform');
  assert.equal(ranA, 1, 'earlier deletion keeps its own timer');
  assert.equal(getPendingDelete(), null);
  undoDelete();
});

test('cancelling by key removes only the matching item', async () => {
  undoDelete();
  undoDelete();
  let ranA = 0;
  let ranB = 0;
  deferDelete('Note "A" deleted', () => { ranA += 1; }, 30, 'note-aaa');
  deferDelete('Note "B" deleted', () => { ranB += 1; }, 30, 'note-bbb');
  cancelPendingDeleteFor('note-aaa');
  assert.equal(ranA, 0, 'cancelled item must not perform');
  assert.equal(getPendingDelete()?.label, 'Note "B" deleted');
  await wait(80);
  assert.equal(ranA, 0);
  assert.equal(ranB, 1, 'other pending deletion untouched');
  assert.equal(getPendingDelete(), null);
  undoDelete();
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

test('a pending delete is cancelled when its key is re-opened (no perform)', async () => {
  undoDelete();
  let ran = 0;
  deferDelete('Note "G" deleted', () => { ran += 1; }, 20, 'note-123');
  cancelPendingDeleteFor('note-123');
  assert.equal(ran, 0, 'cancelling by key must not perform the delete');
  assert.equal(getPendingDelete(), null, 'pending delete is cleared');
  await wait(60);
  assert.equal(ran, 0, 'the deferred delete must never fire after cancel');
});

test('cancelling by a different key leaves the pending delete intact', async () => {
  undoDelete();
  let ran = 0;
  deferDelete('Note "H" deleted', () => { ran += 1; }, 20, 'note-aaa');
  cancelPendingDeleteFor('note-bbb');
  assert.equal(ran, 0);
  assert.ok(getPendingDelete(), 'pending delete still present for another key');
  await wait(60);
  assert.equal(ran, 1, 'unrelated key must not cancel the deletion');
});