'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store/useStore';

export default function PwaRegister() {
  useEffect(() => {
    // Register Service Worker for PWA offline support
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          },
          (err) => {
            console.log('ServiceWorker registration failed: ', err);
          }
        );
      });
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
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  return null;
}
