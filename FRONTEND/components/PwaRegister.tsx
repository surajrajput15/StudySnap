'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store/useStore';

export default function PwaRegister() {
  useEffect(() => {
    // Register Service Worker for PWA offline support. Registration is cheap
    // and idempotent; doing it before `load` when the document is already
    // ready avoids the race where a fast cached load fires `window.load`
    // before this effect runs and registration is silently skipped.
    const register = () => {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.info('ServiceWorker registered:', registration.scope);
        },
        (err) => {
          console.error('ServiceWorker registration failed:', err);
        }
      );
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
    }

    // Monitor online/offline status
    const updateOnlineStatus = () => {
      const isOffline = !navigator.onLine;
      useStore.getState().setOfflineStatus(isOffline);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus(); // Initial run

    return () => {
      window.removeEventListener('load', register);
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  return null;
}