import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  startOfWeek,
  WEEKLY_CHALLENGES,
  computeWeeklyChallengeProgress,
} from '../lib/gamification.ts';

// Day 9 Task 12 — gamification honesty. The leaderboard used to show fabricated
// players (and a hardcoded rank of 420), and the weekly challenge had a target
// whose progress was never derived from activity (always 0). These helpers prove
// every shown number is computed from real persisted data.

const WEEK_START = startOfWeek();
const THIS_WEEK = WEEK_START.getTime() + 1000; // Monday 00:00:01
const LAST_WEEK = WEEK_START.getTime() - 1000; // previous Sunday 23:59:59

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

test('startOfWeek returns Monday 00:00 local time', () => {
  const midWeek = new Date(WEEK_START);
  midWeek.setDate(midWeek.getDate() + 3); // Thursday
  const start = startOfWeek(midWeek);
  assert.equal(start.getDay(), 1, 'must be a Monday');
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(start.getSeconds(), 0);
  assert.equal(start.getTime(), WEEK_START.getTime());
});

test('note-machine counts only notes created this week', () => {
  const progress = computeWeeklyChallengeProgress(
    { id: 'note-machine', target: 10 },
    { notes: [{ createdAt: iso(THIS_WEEK) }, { createdAt: iso(THIS_WEEK) }, { createdAt: iso(LAST_WEEK) }], voiceNotes: [], revisionLogs: [] },
  );
  assert.equal(progress, 2, 'previous-week note must not count');
});

test('revision-rush counts only revisions this week', () => {
  const progress = computeWeeklyChallengeProgress(
    { id: 'revision-rush', target: 15 },
    { notes: [], voiceNotes: [], revisionLogs: [{ revisedAt: iso(THIS_WEEK) }, { revisedAt: iso(LAST_WEEK) }] },
  );
  assert.equal(progress, 1);
});

test('voice-hero counts only voice notes this week', () => {
  const progress = computeWeeklyChallengeProgress(
    { id: 'voice-hero', target: 5 },
    { notes: [], voiceNotes: [{ createdAt: iso(THIS_WEEK) }, { createdAt: iso(LAST_WEEK) }, { createdAt: iso(THIS_WEEK) }], revisionLogs: [] },
  );
  assert.equal(progress, 2);
});

test('streak-defender counts distinct study days this week', () => {
  const day1 = iso(WEEK_START.getTime() + 1000);
  const day2 = iso(WEEK_START.getTime() + 24 * 3600 * 1000 + 1000);
  const progress = computeWeeklyChallengeProgress(
    { id: 'streak-defender', target: 7 },
    {
      notes: [],
      voiceNotes: [],
      revisionLogs: [
        { revisedAt: day1 },
        { revisedAt: day1 }, // same day, still one study day
        { revisedAt: day2 },
        { revisedAt: iso(LAST_WEEK) },
      ],
    },
  );
  assert.equal(progress, 2, 'duplicate days and previous week must not inflate');
});

test('progress never exceeds the challenge target', () => {
  const progress = computeWeeklyChallengeProgress(
    { id: 'voice-hero', target: 2 },
    { notes: [], voiceNotes: [{ createdAt: iso(THIS_WEEK) }, { createdAt: iso(THIS_WEEK) }, { createdAt: iso(THIS_WEEK) }], revisionLogs: [] },
  );
  assert.equal(progress, 2);
});

test('unknown, legacy or missing challenge ids yield zero, never a fake number', () => {
  const data = { notes: [{ createdAt: iso(THIS_WEEK) }], voiceNotes: [], revisionLogs: [] };
  assert.equal(computeWeeklyChallengeProgress(null, data), 0);
  assert.equal(computeWeeklyChallengeProgress(undefined, data), 0);
  assert.equal(computeWeeklyChallengeProgress({ id: 'weekly-challenge', target: 10 }, data), 0);
  assert.equal(computeWeeklyChallengeProgress({ id: 'quiz-master', target: 3 }, data), 0);
});

test('every weekly-challenge type is measurable (no untrackable quiz-master)', () => {
  const ids = WEEKLY_CHALLENGES.map((c) => c.id);
  assert.deepEqual([...ids].sort(), ['note-machine', 'revision-rush', 'streak-defender', 'voice-hero']);
  assert.ok(!ids.includes('quiz-master'), 'untrackable challenge must not be offered');
});