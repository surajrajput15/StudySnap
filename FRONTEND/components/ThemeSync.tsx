'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store/useStore';

export default function ThemeSync() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    // Keep color-scheme + theme-color in sync on runtime toggles
    // (first paint is handled by the blocking head script in app/layout.tsx).
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#1a1c23' : '#0061A4');
  }, [theme]);

  useEffect(() => {
    // Monitor online/offline status for the app shell
    const updateOnlineStatus = () => {
      const isOffline = !navigator.onLine;
      useStore.getState().setOfflineStatus(isOffline);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  return null;
}
