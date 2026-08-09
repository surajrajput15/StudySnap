'use client';

import React from 'react';
import { useStore } from '@/lib/store/useStore';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const isOffline = useStore((s) => s.isOffline);

  if (!isOffline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <WifiOff size={15} />
      <span>You&apos;re offline — everything works, but cloud sync and AI features need a connection.</span>
    </div>
  );
}