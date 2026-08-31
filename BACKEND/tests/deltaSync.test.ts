import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCursor, isUpdatedAfter } from '../src/utils/delta';

// P0 delta-sync cursor semantics — pure helpers backing `GET /api/notes?since=`.

const T1 = '2026-08-01T10:00:00.000Z';
const T2 = '2026-08-02T10:00:00.000Z';
const T3 = '2026-08-03T10:00:00.000Z';

test('computeCursor returns the newest updatedAt among rows', () => {
  const rows = [
    { updatedAt: T1 },
    { updatedAt: T3 },
    { updatedAt: T2 },
  ];
  assert.equal(computeCursor(rows, T1), T3);
});

test('computeCursor never moves backwards on an empty delta (returns since)', () => {
  assert.equal(computeCursor([], T2), T2);
});

test('isUpdatedAfter is a strict greater-than boundary', () => {
  assert.equal(isUpdatedAfter({ updatedAt: T3 }, T2), true);
  assert.equal(isUpdatedAfter({ updatedAt: T2 }, T2), false);
  assert.equal(isUpdatedAfter({ updatedAt: T1 }, T2), false);
});

test('computeCursor handles Date objects as well as ISO strings', () => {
  assert.equal(computeCursor([{ updatedAt: new Date(T3) }], T1), T3);
});
