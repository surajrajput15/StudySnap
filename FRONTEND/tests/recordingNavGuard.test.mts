import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECORDING_NAV_CONFIRM_MESSAGE,
  shouldConfirmRecordingNav,
} from '../lib/utils.ts';

// Day 9 Task 4 — regression: leaving the voice tab while recording used to
// silently discard the active recording (the app shell unmounted VoiceNotes
// without any confirmation). The guarded navigation chokepoint now asks first;
// this spec pins down exactly when that confirmation must appear.

test('Leaving the voice tab while recording always requires confirmation', () => {
  for (const nextTab of ['home', 'editor', 'calendar', 'ai', 'gamification', 'profile']) {
    assert.equal(
      shouldConfirmRecordingNav('voice', nextTab, true),
      true,
      `voice -> ${nextTab} while recording must confirm`,
    );
  }
});

test('Re-selecting the voice tab while recording never confirms', () => {
  assert.equal(shouldConfirmRecordingNav('voice', 'voice', true), false);
});

test('Recording state is false: navigating away from the voice tab never confirms', () => {
  for (const nextTab of ['home', 'editor', 'calendar', 'ai', 'gamification', 'profile']) {
    assert.equal(shouldConfirmRecordingNav('voice', nextTab, false), false);
  }
});

test('Navigating TO the voice tab never confirms', () => {
  assert.equal(shouldConfirmRecordingNav('home', 'voice', true), false);
  assert.equal(shouldConfirmRecordingNav('editor', 'voice', false), false);
});

test('A recording flag is never trusted on a non-voice tab (defensive)', () => {
  assert.equal(shouldConfirmRecordingNav('home', 'editor', true), false);
  assert.equal(shouldConfirmRecordingNav('profile', 'home', true), false);
});

test('The confirmation copy is shared so every guard presents the same message', () => {
  assert.equal(RECORDING_NAV_CONFIRM_MESSAGE, 'You are still recording. Leave and discard this recording?');
  assert.ok(RECORDING_NAV_CONFIRM_MESSAGE.length > 0);
});