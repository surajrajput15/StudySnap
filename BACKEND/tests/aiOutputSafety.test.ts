import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonArray } from '../src/services/ai.ts';
import { isAiQuotaExceeded } from '../src/routes/ai.ts';
import {
  checkPinLocked,
  recordPinFailure,
  clearPinFailures,
} from '../src/routes/notes.ts';

// Phase 1 P0 — model-output hardening: malformed/empty/wrong-shaped output
// must THROW (honest 500) instead of returning fake 200 content.

test('parseJsonArray parses a valid MCQ array', () => {
  const raw = 'Here you go: [{"question":"Q?","options":["a","b","c","d"],"answer":1,"explanation":"e"}] done.';
  const out = parseJsonArray<{ question: string; options: string[]; answer: number }>(raw, 'mcq');
  assert.equal(out.length, 1);
  assert.equal(out[0].question, 'Q?');
});

test('parseJsonArray throws when no JSON array is present', () => {
  assert.throws(() => parseJsonArray('just some prose, no json here', 'mcq'), /no JSON array/);
  assert.throws(() => parseJsonArray(null, 'mcq'), /no JSON array/);
  assert.throws(() => parseJsonArray('', 'flashcard'), /no JSON array/);
});

test('parseJsonArray throws on malformed JSON', () => {
  assert.throws(() => parseJsonArray('[{"question": broken}]', 'mcq'), /malformed JSON/);
});

test('parseJsonArray throws on empty arrays (no fake-200)', () => {
  // '[]' carries no object, so it fails at the array-extraction step.
  assert.throws(() => parseJsonArray('[]', 'mcq'), /no JSON array/);
});

test('parseJsonArray drops garbage items but keeps valid ones', () => {
  const raw = JSON.stringify([
    { question: 'Q?', options: ['a', 'b'], answer: 0, explanation: 'e' },
    { nonsense: true },
    { question: 'Q2?', options: ['a', 'b'], answer: 5, explanation: 'e' },
  ]);
  const out = parseJsonArray<{ question: string }>(raw, 'mcq');
  assert.equal(out.length, 1);
  assert.equal(out[0].question, 'Q?');
});

test('parseJsonArray throws when every item is unusable', () => {
  assert.throws(() => parseJsonArray('[{"nonsense":true}]', 'mcq'), /unusable/);
  assert.throws(() => parseJsonArray('[{"question":"","answer":123}]', 'flashcard'), /unusable/);
});

test('parseJsonArray validates flashcards shape', () => {
  const raw = JSON.stringify([{ question: 'What is X?', answer: 'Y.' }]);
  const out = parseJsonArray<{ question: string; answer: string }>(raw, 'flashcard');
  assert.equal(out.length, 1);
});

// Phase 1 P0 — AI quota decision table.

test('isAiQuotaExceeded fails open when Redis is down (null counters)', () => {
  assert.equal(isAiQuotaExceeded(null, null, 10), false);
  assert.equal(isAiQuotaExceeded(null, 100, 10), false);
  assert.equal(isAiQuotaExceeded(10, null, 10), false);
});

test('isAiQuotaExceeded denies at either cap', () => {
  assert.equal(isAiQuotaExceeded(50, 0, 10), true, 'request cap');
  assert.equal(isAiQuotaExceeded(0, 499_999, 10), true, 'char cap with this request');
  assert.equal(isAiQuotaExceeded(49, 499_990, 10), false, 'just under both caps');
  assert.equal(isAiQuotaExceeded(0, 0, 0), false, 'empty request allowed');
});

// Phase 1 P0 — per-note PIN lockout state machine.

test('PIN lockout triggers after 5 failures and clears on success', () => {
  const user = 'pin-test-user';
  const note = 'pin-test-note';
  clearPinFailures(user, note);
  for (let i = 0; i < 4; i++) {
    recordPinFailure(user, note);
    assert.equal(checkPinLocked(user, note), false, `attempt ${i + 1} must not lock yet`);
  }
  recordPinFailure(user, note);
  assert.equal(checkPinLocked(user, note), true, '5th failure locks the note');
  clearPinFailures(user, note);
  assert.equal(checkPinLocked(user, note), false, 'success clears the lockout');
});

test('PIN lockout is per-note isolated', () => {
  const user = 'pin-test-user-2';
  clearPinFailures(user, 'note-a');
  clearPinFailures(user, 'note-b');
  for (let i = 0; i < 5; i++) recordPinFailure(user, 'note-a');
  assert.equal(checkPinLocked(user, 'note-a'), true);
  assert.equal(checkPinLocked(user, 'note-b'), false, 'other notes unaffected');
  clearPinFailures(user, 'note-a');
});
