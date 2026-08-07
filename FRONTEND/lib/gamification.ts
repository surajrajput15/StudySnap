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
