'use client';

import React, { useEffect, useReducer } from 'react';
import { getPendingDelete, subscribeDeleteUndo, undoDelete } from '@/lib/undo';

// Day 9 Task 9 — global "deleted … Undo" toast. Renders once (in the app
// shell); the underlying pending deletion lives in lib/undo, so this is a
// passive mirror that never owns the delete lifecycle.
export default function DeleteUndoToast() {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeDeleteUndo(forceUpdate), []);

  const pending = getPendingDelete();
  if (!pending) return null;

  return (
    <div className="delete-undo-toast" role="status" aria-live="polite">
      <span className="delete-undo-label">{pending.label}</span>
      <button type="button" className="delete-undo-action" onClick={undoDelete}>
        Undo
      </button>
    </div>
  );
}