import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_TAB_IDS, isValidAppTab } from '../lib/utils.ts';

// Day 9 Task 8 — regression: the mobile drawer used to list entries that had
// no real view (Folders, Favorites, Statistics, Settings, About all collapsed
// onto home/profile) while omitting Achievements and Profile. Every drawer item
// must now map to a genuinely rendered tab.

test('Every real app tab is a valid navigation target', () => {
  for (const id of ['home', 'editor', 'voice', 'calendar', 'ai', 'gamification', 'profile']) {
    assert.equal(isValidAppTab(id), true, `${id} must be a valid tab`);
  }
});

test('The dead drawer aliases are no longer valid targets', () => {
  for (const id of ['folders', 'favorites', 'statistics', 'settings', 'about']) {
    assert.equal(isValidAppTab(id), false, `${id} must not resolve to a real tab`);
  }
});

test('Unknown or stray ids are invalid', () => {
  for (const id of ['', 'bogus', 'home2', 'profile-extra']) {
    assert.equal(isValidAppTab(id), false, `${JSON.stringify(id)} must be rejected`);
  }
});

test('The canonical tab list is exactly the seven rendered tabs', () => {
  assert.deepEqual(
    [...APP_TAB_IDS].sort(),
    ['ai', 'calendar', 'editor', 'gamification', 'home', 'profile', 'voice'],
  );
  assert.equal(new Set(APP_TAB_IDS).size, APP_TAB_IDS.length, 'no duplicate ids');
});