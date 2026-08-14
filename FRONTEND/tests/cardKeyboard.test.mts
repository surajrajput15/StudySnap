import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleCardKeyDown } from '../lib/utils.ts';

// Day 11 Task 2 — the dashboard note grid/list cards (components/NoteCards.tsx)
// are wrapped in React.memo so a single-note update re-renders only that card.
// The memo wrapper is enforced structurally (React.memo in the .tsx source); the
// shared keyboard-activation helper they all use lives in lib/utils.ts and is
// covered here.

function makeEvent(key: string) {
  return {
    key,
    preventDefaultCalls: 0,
    preventDefault() { this.preventDefaultCalls += 1; },
  };
}

test('handleCardKeyDown opens the card on Enter', () => {
  const e = makeEvent('Enter');
  let opened = 0;
  handleCardKeyDown(e, () => { opened += 1; });
  assert.equal(opened, 1);
  assert.equal(e.preventDefaultCalls, 1);
});

test('handleCardKeyDown opens the card on Space', () => {
  const e = makeEvent(' ');
  let opened = 0;
  handleCardKeyDown(e, () => { opened += 1; });
  assert.equal(opened, 1);
  assert.equal(e.preventDefaultCalls, 1);
});

test('handleCardKeyDown ignores other keys', () => {
  const e = makeEvent('Tab');
  let opened = 0;
  handleCardKeyDown(e, () => { opened += 1; });
  assert.equal(opened, 0);
  assert.equal(e.preventDefaultCalls, 0);
});