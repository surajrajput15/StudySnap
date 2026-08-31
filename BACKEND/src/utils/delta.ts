/**
 * Delta-sync cursor helpers (P0).
 *
 * A `since` cursor lets a client pull only the notes that changed after a
 * saved point in time (`updated_at`). These pure functions keep the cursor
 * semantics testable and identical across the DB and mock storage paths.
 */

/** Newest updated_at among the returned rows, as an ISO string; falls back to
 *  `since` when no row qualifies so the cursor never moves backwards on an
 *  empty delta. */
export function computeCursor(
  rows: Array<{ updatedAt: Date | string }>,
  since: string
): string {
  if (rows.length === 0) return since;
  const maxTime = rows.reduce(
    (max, row) => Math.max(max, new Date(row.updatedAt).getTime()),
    -Infinity
  );
  return new Date(maxTime).toISOString();
}

/** Strictly-newer-than `since` predicate used to filter rows in memory (the
 *  mock storage path). Mirrors the SQL `updated_at > since` boundary. */
export function isUpdatedAfter(row: { updatedAt: Date | string }, since: Date | string): boolean {
  return new Date(row.updatedAt).getTime() > new Date(since).getTime();
}
