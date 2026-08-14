'use client';

import React, { useEffect, useState } from 'react';
import { initClientCrashLogging, ERROR_TOAST_EVENT } from '@/lib/observability';

// Day 15 Tasks 3/7 — global error toast + client crash logger. Mounted once in
// the root layout: registers the window-level crash listeners and renders any
// user-facing error that flows through the shared notifyError() channel, so
// native alert() calls can be retired feature-by-feature.
export default function ErrorToast() {
  const [notice, setNotice] = useState<{ message: string; key: number } | null>(null);

  useEffect(() => {
    const unsubscribe = initClientCrashLogging();
    const onError = (event: Event) => {
      const detail = (event as CustomEvent).detail as { message?: string } | undefined;
      if (!detail?.message) return;
      setNotice((prev) => ({ message: detail.message as string, key: (prev?.key ?? 0) + 1 }));
    };
    window.addEventListener(ERROR_TOAST_EVENT, onError);
    return () => {
      unsubscribe();
      window.removeEventListener(ERROR_TOAST_EVENT, onError);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;

  return (
    <div className="error-toast" role="alert" key={notice.key}>
      <span className="error-toast-icon" aria-hidden="true">!</span>
      <span className="error-toast-message">{notice.message}</span>
      <button type="button" className="error-toast-dismiss" onClick={() => setNotice(null)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}