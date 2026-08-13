import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tutorConnectionLabel, tutorConnectionClass } from '../lib/utils.ts';

// Day 9 Task 15 — the AI tutor header badge previously claimed "Online"
// unconditionally. These helpers drive the badge so it reflects real
// connectivity from the store's isOffline flag.
// Day 10 Task 1 — `reachable` (request-outcome) is a second axis: navigator
// onLine can be true while the AI service is unreachable (Wi-Fi w/o internet,
// backend down), so the badge shows "Unreachable" instead of a false "Online".
test('tutorConnectionLabel reports Online when connected', () => {
  assert.equal(tutorConnectionLabel(false), 'Online');
});

test('tutorConnectionLabel reports Offline when disconnected', () => {
  assert.equal(tutorConnectionLabel(true), 'Offline');
});

test('tutorConnectionLabel reports Unreachable when online but the request failed', () => {
  assert.equal(tutorConnectionLabel(false, false), 'Unreachable');
});

test('tutorConnectionClass adds the offline modifier only when offline', () => {
  assert.equal(tutorConnectionClass(true), ' tutor-status-offline');
  assert.equal(tutorConnectionClass(false), '');
});

test('tutorConnectionClass adds the unreachable modifier only when requests fail', () => {
  assert.equal(tutorConnectionClass(false, false), ' tutor-status-unreachable');
  assert.equal(tutorConnectionClass(true, false), ' tutor-status-offline');
  assert.equal(tutorConnectionClass(false, true), '');
});

test('badge never claims Online while offline', () => {
  for (const offline of [true, false]) {
    const label = tutorConnectionLabel(offline);
    const isOfflineBadge = label === 'Offline';
    assert.equal(isOfflineBadge, offline, 'label must match the real connection state');
  }
});

test('badge never claims Online while the service is unreachable', () => {
  const label = tutorConnectionLabel(false, false);
  assert.notEqual(label, 'Online');
  assert.equal(label, 'Unreachable');
});
