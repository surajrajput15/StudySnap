'use client';

import React from 'react';
import { useStore } from '@/lib/store/useStore';
import { RefreshCw } from 'lucide-react';

/**
 * Day 8 Task 3 (Phase B) — minimal, unobtrusive sync status pill.
 * Reads the ephemeral `syncStatus` from the store (the sync engine writes it)
 * and renders only while a sync run, offline wait, or retry cooldown is active.
 * The button is the "manual retry" trigger the engine exposes.
 */
export default function SyncStatusIndicator({ onRetry }: { onRetry?: () => void }) {
  const status = useStore((s) => s.syncStatus);

  if (!status) return null;
  const busy = status.phase === 'running';
  const offline = status.phase === 'offline';
  const cooldown = status.phase === 'cooldown';
  if (!busy && !offline && !cooldown) return null;

  const label = busy ? 'Syncing…' : offline ? 'Offline' : cooldown ? 'Retrying' : '';
  const variant = busy ? 'busy' : offline ? 'offline' : 'retrying';

  return (
    <button
      type="button"
      className={`sync-status-indicator sync-status-${variant}`}
      onClick={onRetry}
      disabled={busy}
      title={busy ? 'Syncing your notes…' : 'Last sync needs attention — tap to retry now'}
      aria-live="polite"
      role="status"
    >
      <span className="sync-status-dot" aria-hidden="true" />
      <span className="sync-status-label">{label}</span>
      {!busy && <RefreshCw size={12} aria-hidden="true" />}
    </button>
  );
}