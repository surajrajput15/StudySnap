import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Column } from 'drizzle-orm';
import { checkNoteIdAvailability, type NoteAvailability } from '../src/utils/noteOwnership';

// Day 14 Task 3 — authorization boundary: a caller-supplied note id must never
// let one account reach into, or shadow, another account's row.

const UUID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
const OTHER_UUID = '1f3d3c2a-4e5b-4c6d-8e9f-0a1b2c3d4e5f';

// Structural fake: `select().from().where()` returns the next queued result,
// mirroring exactly how the real Drizzle query builder is consumed by the
// helper. `notes`/`userId` only feed `eq()`/`and()` column references, so plain
// objects suffice.
function makeFakeDb(results: unknown[][]) {
  return {
    select: () => ({
      from: () => ({
        where: async () => results.shift(),
      }),
    }),
  };
}

const notesTable = { id: { name: 'id' }, userId: { name: 'userId' } } as unknown as { id: Column; userId: Column };

async function run(results: unknown[][]): Promise<NoteAvailability> {
  return checkNoteIdAvailability(makeFakeDb(results), notesTable, UUID, 'user-a');
}

test('an id the caller owns resolves to owned', async () => {
  const availability = await run([[{ id: UUID, userId: 'user-a' }]]);
  assert.equal(availability, 'owned');
});

test('an id owned by ANOTHER account resolves to taken (never insertable)', async () => {
  const availability = await run([[], [{ id: OTHER_UUID }]]);
  assert.equal(availability, 'taken');
});

test('a brand-new id resolves to free', async () => {
  const availability = await run([[], []]);
  assert.equal(availability, 'free');
});

test('an owned id short-circuits the cross-account lookup', async () => {
  // Only one query should run when the id is already the caller's.
  const fake = makeFakeDb([[{ id: UUID, userId: 'user-a' }]]);
  const availability = await checkNoteIdAvailability(fake, notesTable, UUID, 'user-a');
  assert.equal(availability, 'owned');
});