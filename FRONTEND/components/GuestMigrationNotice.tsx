'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useStore } from '@/lib/store/useStore';

// Day 9 Task 16 — one-time banner shown right after a guest signs in and their
// anonymous-scope data is folded into their account. Dismissible, ephemeral
// (never persisted), and renders nothing when there is no pending migration.
export default function GuestMigrationNotice() {
  const migration = useStore((s) => s.guestMigration);
  const setGuestMigration = useStore((s) => s.setGuestMigration);

  if (!migration) return null;

  const items: string[] = [];
  if (migration.notes > 0) items.push(`${migration.notes} note${migration.notes === 1 ? '' : 's'}`);
  if (migration.voiceNotes > 0) items.push(`${migration.voiceNotes} voice memo${migration.voiceNotes === 1 ? '' : 's'}`);
  if (migration.folders > 0) items.push(`${migration.folders} folder${migration.folders === 1 ? '' : 's'}`);
  if (migration.coins > 0) items.push(`${migration.coins} coin${migration.coins === 1 ? '' : 's'}`);
  const moved = items.length > 0 ? items.join(', ') : 'Your saved data';

  return (
    <div className="guest-migration-notice" role="status" aria-live="polite">
      <span className="guest-migration-check" aria-hidden="true" />
      <div className="guest-migration-text">
        <strong>Welcome! Your guest data was saved.</strong>
        <span>{moved} moved into your account.</span>
      </div>
      <button
        type="button"
        className="guest-migration-close"
        onClick={() => setGuestMigration(null)}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}