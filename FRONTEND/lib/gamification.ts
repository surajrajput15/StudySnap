export function getXpLevel(xp: number): { level: number; progress: number; current: number; next: number } {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const current = 100 * (level - 1) ** 2;
  const next = 100 * level ** 2;
  const progress = Math.min(((xp - current) / (next - current)) * 100, 100);
  return { level, progress, current, next };
}

export function getMonthlyReport(revisionLogs: { revisedAt: string }[], includeYear = false) {
  const months: Record<string, number> = {};
  for (const log of revisionLogs) {
    const label = new Date(log.revisedAt).toLocaleString(
      'en',
      includeYear ? { month: 'short', year: 'numeric' } : { month: 'short' }
    );
    months[label] = (months[label] || 0) + 1;
  }
  return Object.entries(months).slice(-6);
}

// ═══ Day 9 Task 12 — gamification honesty ═══════════════════════════════════
// Every weekly-challenge type below is measurable from persisted activity, so
// the UI can show REAL progress instead of a target that never moves (the old
// "Quiz Master" type had no persisted source of truth and was dropped).

export interface WeeklyChallengeDefinition {
  id: string;
  label: string;
  description: string;
  target: number;
  xpReward: number;
  coinReward: number;
}

/** Monday 00:00 local time of the week containing `reference` (default now). */
export function startOfWeek(reference: Date = new Date()): Date {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  return start;
}

export const WEEKLY_CHALLENGES: WeeklyChallengeDefinition[] = [
  { id: 'note-machine', label: 'Note Machine', description: 'Create notes this week', target: 10, xpReward: 500, coinReward: 100 },
  { id: 'revision-rush', label: 'Revision Rush', description: 'Complete revisions this week', target: 15, xpReward: 600, coinReward: 120 },
  { id: 'voice-hero', label: 'Voice Hero', description: 'Record voice notes this week', target: 5, xpReward: 400, coinReward: 80 },
  { id: 'streak-defender', label: 'Streak Defender', description: 'Study every day this week', target: 7, xpReward: 700, coinReward: 150 },
];

export function pickWeeklyChallenge(): WeeklyChallengeDefinition {
  return WEEKLY_CHALLENGES[Math.floor(Math.random() * WEEKLY_CHALLENGES.length)];
}

export interface WeeklyChallengeData {
  notes: { createdAt: string }[];
  voiceNotes: { createdAt: string }[];
  revisionLogs: { revisedAt: string }[];
}

/** REAL, data-derived progress for a weekly challenge, bounded to its target.
 *  Unknown/legacy ids return 0 rather than a fabricated number. */
export function computeWeeklyChallengeProgress(
  challenge: { id: string; target?: number } | null | undefined,
  data: WeeklyChallengeData,
): number {
  if (!challenge) return 0;
  const weekStart = startOfWeek().getTime();
  const bound = (n: number) => Math.min(n, challenge.target ?? Number.MAX_SAFE_INTEGER);
  switch (challenge.id) {
    case 'note-machine':
      return bound(data.notes.filter((n) => new Date(n.createdAt).getTime() >= weekStart).length);
    case 'revision-rush':
      return bound(data.revisionLogs.filter((l) => new Date(l.revisedAt).getTime() >= weekStart).length);
    case 'voice-hero':
      return bound(data.voiceNotes.filter((v) => new Date(v.createdAt).getTime() >= weekStart).length);
    case 'streak-defender': {
      const days = new Set(
        data.revisionLogs
          .filter((l) => new Date(l.revisedAt).getTime() >= weekStart)
          .map((l) => new Date(l.revisedAt).toDateString()),
      );
      return bound(days.size);
    }
    default:
      return 0;
  }
}
