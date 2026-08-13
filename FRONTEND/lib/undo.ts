// Day 9 Task 9 — module-level delete-undo manager. A single-click delete is
// deferred for a short window and only actually performed (local removal +
// tombstone + remote DELETE) if the user does not hit Undo. The pending payload
// and its timer live OUTSIDE React, so navigating away (which unmounts the
// calling component) can never swallow a pending deletion — the item is still
// deleted once the window expires — and an undo is safe even mid-window.

export const DELETE_UNDO_WINDOW_MS = 5000;

interface PendingDelete {
  id: number;
  label: string;
  timer: ReturnType<typeof setTimeout>;
  perform: () => void;
}

let nextId = 1;
let pendingDelete: PendingDelete | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function clearPendingTimer(): void {
  if (pendingDelete) {
    clearTimeout(pendingDelete.timer);
    pendingDelete = null;
  }
}

/** Schedules `perform` to run after `windowMs` unless undone first. A previous
 *  pending deletion that is superseded is STILL honored: its `perform` runs
 *  immediately instead of being silently dropped, so an item the user already
 *  saw a "deleted" toast for can never stay on-screen AND on the server. */
export function deferDelete(label: string, perform: () => void, windowMs: number = DELETE_UNDO_WINDOW_MS): void {
  if (pendingDelete) {
    clearTimeout(pendingDelete.timer);
    pendingDelete.perform();
    pendingDelete = null;
  }
  const timer = setTimeout(() => {
    perform();
    pendingDelete = null;
    emit();
  }, windowMs);
  pendingDelete = { id: nextId++, label, timer, perform };
  emit();
}

/** Cancels the pending deletion without performing it. */
export function undoDelete(): void {
  clearPendingTimer();
  emit();
}

/** Current pending deletion for the toast UI, or null. */
export function getPendingDelete(): { id: number; label: string } | null {
  return pendingDelete ? { id: pendingDelete.id, label: pendingDelete.label } : null;
}

/** Subscribes to pending-delete changes; returns an unsubscribe function. */
export function subscribeDeleteUndo(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}