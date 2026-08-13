import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEARCH_EMPTY_MESSAGE,
  SEARCH_EMPTY_TIP,
  hasActiveSearch,
  noteMatchesSearch,
} from '../lib/utils.ts';

// Day 9 Task 6 — regression: an active search with no matches used to show the
// generic "No Study Notes Yet — create a note" empty state, which is misleading
// ("your journey starts here") when notes exist but none match the query. The
// search-specific empty state is shown only when a search is actually active.

function note(title: string, content: string, tags: string[]) {
  return { title, content, tags };
}

test('hasActiveSearch is false for blank or whitespace-only queries', () => {
  assert.equal(hasActiveSearch(''), false);
  assert.equal(hasActiveSearch('   '), false);
  assert.equal(hasActiveSearch('\t\n'), false);
});

test('hasActiveSearch is true once a query has non-whitespace text', () => {
  assert.equal(hasActiveSearch('physics'), true);
  assert.equal(hasActiveSearch('  quantum  '), true);
});

test('Blank query matches every note (search is not filtering)', () => {
  const anyNote = note('Anything', 'Whatever body', ['irrelevant']);
  assert.equal(noteMatchesSearch('', anyNote), true);
  assert.equal(noteMatchesSearch('   ', anyNote), true);
});

test('Search matches the note title, case-insensitively', () => {
  const n = note('Thermodynamics', 'Entropy and enthalpy', ['physics']);
  assert.equal(noteMatchesSearch('thermo', n), true);
  assert.equal(noteMatchesSearch('THERMO', n), true);
  assert.equal(noteMatchesSearch('dynamics', n), true);
});

test('Search matches the note content', () => {
  const n = note('Chemistry', 'Organic reactions and benzene rings', ['chem']);
  assert.equal(noteMatchesSearch('benzene', n), true);
});

test('Search matches a tag, case-insensitively', () => {
  const n = note('Math', 'Calculus notes', ['Calculus-I']);
  assert.equal(noteMatchesSearch('calculus', n), true);
  assert.equal(noteMatchesSearch('calcu', n), true);
});

test('Non-matching query returns false', () => {
  const n = note('Biology', 'Cells and DNA', ['life-sciences']);
  assert.equal(noteMatchesSearch('algebra', n), false);
});

test('The query is trimmed before matching', () => {
  const n = note('Osmosis', 'Water movement', ['bio']);
  assert.equal(noteMatchesSearch('  osmosis  ', n), true);
});

test('The search empty-state copy is present and non-empty', () => {
  assert.ok(SEARCH_EMPTY_MESSAGE.length > 0);
  assert.ok(SEARCH_EMPTY_TIP.length > 0);
});