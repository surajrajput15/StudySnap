import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tutorConnectionLabel, tutorConnectionClass } from '../lib/utils.ts';

// Day 9 Task 15 — the AI tutor header badge previously claimed "Online"
// unconditionally. These helpers drive the badge so it reflects real
// connectivity from the store's isOffline flag.
test('tutorConnectionLabel reports Online when connected', () => {
  assert.equal(tutorConnectionLabel(false), 'Online');
});

test('tutorConnectionLabel reports Offline when disconnected', () => {
  assert.equal(tutorConnectionLabel(true), 'Offline');
});

test('tutorConnectionClass adds the offline modifier only when offline', () => {
  assert.equal(tutorConnectionClass(true), ' tutor-status-offline');
  assert.equal(tutorConnectionClass(false), '');
});

test('badge never claims Online while offline', () => {
  for (const offline of [true, false]) {
    const label = tutorConnectionLabel(offline);
    const isOfflineBadge = label === 'Offline';
    assert.equal(isOfflineBadge, offline, 'label must match the real connection state');
  }
});