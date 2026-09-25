// Day 9 Task 9 — module-level delete-undo manager. A single-click delete is
// deferred for a short window and only actually performed (local removal +
// tombstone + remote DELETE) if the user does not hit Undo. The pending payloads
// and their timers live OUTSIDE React, so navigating away (which unmounts the
// calling component) can never swallow a pending deletion — the item is still
// deleted once the window expires — and an undo is safe even mid-window.
//
// Phase A fix: pending deletions form a QUEUE, one timer each. Deferring a new
// delete no longer force-fires the previous one — rapid delete-A + delete-B
// keeps BOTH inside their own undo windows. The toast shows the most recent
// pending item; Undo cancels exactly that one; earlier items keep their own
// timers. An optional `key` lets callers cancel a specific pending deletion
// (e.g. when the user re-opens a note that is still inside its undo window).

export const DELETE_UNDO_WINDOW_MS = 5000;

interface PendingDelete {
  id: number;
  label: string;
  key?: string;
  timer: ReturnType<typeof setTimeout>;
  perform: () => void;
}

let nextId = 1;
const pendingDeletes: PendingDelete[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function removePending(id: number, fire: boolean): void {
  const index = pendingDeletes.findIndex((p) => p.id === id);
  if (index === -1) return;
  const [item] = pendingDeletes.splice(index, 1);
  clearTimeout(item.timer);
  if (fire) item.perform();
  emit();
}

/** Schedules `perform` to run after `windowMs` unless undone first. Earlier
 *  pending deletions keep their own timers and are NOT fired early. */
export function deferDelete(label: string, perform: () => void, windowMs: number = DELETE_UNDO_WINDOW_MS, key?: string): void {
  const timer = setTimeout(() => {
    removePending(item.id, true);
  }, windowMs);
  const item: PendingDelete = { id: nextId++, label, key, timer, perform };
  pendingDeletes.push(item);
  emit();
}

/** Cancels the most recent pending deletion without performing it. Earlier
 *  pending deletions keep their own timers. */
export function undoDelete(): void {
  const latest = pendingDeletes[pendingDeletes.length - 1];
  if (!latest) return;
  removePending(latest.id, false);
}

/** Cancels the pending deletion(s) scheduled with the given key, without
 *  performing them. Used to cancel a pending note delete when the user
 *  re-opens that note within the undo window, so editing it cannot be
 *  silently reverted mid-delete. Other pending deletions are untouched. */
export function cancelPendingDeleteFor(key: string): void {
  const matching = pendingDeletes.filter((p) => p.key === key);
  if (matching.length === 0) return;
  for (const item of matching) {
    const index = pendingDeletes.indexOf(item);
    if (index !== -1) {
      pendingDeletes.splice(index, 1);
      clearTimeout(item.timer);
    }
  }
  emit();
}

/** Most recent pending deletion for the toast UI, or null. */
export function getPendingDelete(): { id: number; label: string } | null {
  const latest = pendingDeletes[pendingDeletes.length - 1];
  return latest ? { id: latest.id, label: latest.label } : null;
}

/** Subscribes to pending-delete changes; returns an unsubscribe function. */
export function subscribeDeleteUndo(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
