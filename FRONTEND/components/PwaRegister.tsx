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
          // Phase B P2: update prompt. When a new worker finishes installing
          // while a page is already controlled, the user is on stale assets
          // with no indication. Ask once (explicit consent — never surprise-
          // reload, which could discard an in-progress recording); on accept,
          // tell the waiting worker to activate and reload on takeover.
          registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener('statechange', () => {
              if (
                worker.state === 'installed' &&
                navigator.serviceWorker.controller &&
                !sessionStorage.getItem('studysnap:sw-update-prompted')
              ) {
                sessionStorage.setItem('studysnap:sw-update-prompted', '1');
                if (window.confirm('A new version of StudySnap is available. Reload to update?')) {
                  worker.postMessage({ type: 'SKIP_WAITING' });
                  let reloaded = false;
                  navigator.serviceWorker.addEventListener(
                    'controllerchange',
                    () => {
                      if (!reloaded) {
                        reloaded = true;
                        window.location.reload();
                      }
                    },
                    { once: true }
                  );
                  // Fallback if takeover stalls: reload anyway after 2s.
                  setTimeout(() => {
                    if (!reloaded) {
                      reloaded = true;
                      window.location.reload();
                    }
                  }, 2000);
                }
              }
            });
          });
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