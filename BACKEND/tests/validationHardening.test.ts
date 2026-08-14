import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  noteSchema,
  aiContentSchema,
  aiChatSchema,
  clerkEventSchema,
  clerkUserCreatedDataSchema,
} from '../src/middleware/validate';

// Day 14 Task 2 — note content must be BOUNDED at the API edge. The old schema
// was `content: z.string()` (unbounded), so a client could stream an arbitrary
// amount of text into the DB/memory. The cap is generous (1M chars ≈ a long
// textbook) but never unlimited.

const UUID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

function validBody() {
  return { id: UUID, title: 'A note', content: 'some content' };
}

test('a normal note validates', () => {
  const parsed = noteSchema.safeParse(validBody());
  assert.equal(parsed.success, true);
});

test('an empty note (mid-typing) still validates', () => {
  const parsed = noteSchema.safeParse({ title: 'A', content: '' });
  assert.equal(parsed.success, true);
});

test('content is capped at 1,000,000 chars', () => {
  const ok = noteSchema.safeParse({ title: 'A', content: 'x'.repeat(1_000_000) });
  assert.equal(ok.success, true);

  const tooBig = noteSchema.safeParse({ title: 'A', content: 'x'.repeat(1_000_001) });
  assert.equal(tooBig.success, false);
});

test('title is capped at 500 chars and required', () => {
  assert.equal(noteSchema.safeParse({ title: 'y'.repeat(501), content: 'z' }).success, false);
  assert.equal(noteSchema.safeParse({ title: '', content: 'z' }).success, false);
});

test('ids must be UUIDs', () => {
  assert.equal(noteSchema.safeParse({ ...validBody(), id: 'not-a-uuid' }).success, false);
  assert.equal(noteSchema.safeParse({ ...validBody(), categoryId: 'nope' }).success, false);
  assert.equal(noteSchema.safeParse({ ...validBody(), folderId: 'nope' }).success, false);
});

test('tags are capped in count and per-tag length', () => {
  const ok = noteSchema.safeParse({ ...validBody(), tags: ['math', 'revision'] });
  assert.equal(ok.success, true);
  if (ok.success) assert.deepEqual(ok.data.tags, ['math', 'revision']);

  // 21 tags (over the 20 cap) must fail.
  const tooMany = noteSchema.safeParse({ ...validBody(), tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`) });
  assert.equal(tooMany.success, false);

  // A single oversized tag must fail.
  assert.equal(noteSchema.safeParse({ ...validBody(), tags: ['x'.repeat(51)] }).success, false);

  // A lone string tag is still accepted (frontend legacy shape).
  assert.equal(noteSchema.safeParse({ ...validBody(), tags: 'solo' }).success, true);
});

test('ai chat messages require non-empty content, bounded count', () => {
  assert.equal(
    aiChatSchema.safeParse({ messages: [{ role: 'user', content: '' }] }).success,
    false,
    'empty message content is rejected'
  );
  assert.equal(
    aiChatSchema.safeParse({ messages: [{ role: 'user', content: 'hi' }] }).success,
    true
  );
  assert.equal(aiChatSchema.safeParse({ messages: [] }).success, false);
});

test('ai content schema preserves the mcq/flashcard routing type', () => {
  const mcq = aiContentSchema.safeParse({ title: 'T', content: 'c', type: 'mcq' });
  assert.equal(mcq.success, true);
  if (mcq.success) assert.equal(mcq.data.type, 'mcq');

  const card = aiContentSchema.safeParse({ title: 'T', content: 'c', type: 'flashcard' });
  assert.equal(card.success, true);
  if (card.success) assert.equal(card.data.type, 'flashcard');

  // An unknown type must be rejected rather than silently dropped (the old bug
  // stripped unknown keys, so `type: "flashcard"` requests returned MCQs).
  assert.equal(aiContentSchema.safeParse({ title: 'T', content: 'c', type: 'bogus' }).success, false);
});

test('clerk webhook event shape is bounded', () => {
  assert.equal(clerkEventSchema.safeParse({ type: 'user.created' }).success, true);
  assert.equal(clerkEventSchema.safeParse({ type: '' }).success, false);
  assert.equal(clerkEventSchema.safeParse({ type: 'x'.repeat(101) }).success, false);
  assert.equal(clerkEventSchema.safeParse({}).success, false);
});

test('clerk user.created data is bounded', () => {
  assert.equal(
    clerkUserCreatedDataSchema.safeParse({ id: 'user_abc', first_name: 'Ada', last_name: 'Lovelace' }).success,
    true
  );
  assert.equal(
    clerkUserCreatedDataSchema.safeParse({ id: 'user_abc', first_name: 'x'.repeat(201) }).success,
    false,
    'over-long name is rejected'
  );
  assert.equal(clerkUserCreatedDataSchema.safeParse({}).success, false, 'id is required');
});