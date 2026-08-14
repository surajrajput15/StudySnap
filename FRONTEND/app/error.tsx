'use client';

import React from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';

// Day 15 Task 1 — route-level error boundary. A render error anywhere under
// the `/` route (the whole app shell) now shows a recoverable screen instead
// of a permanent white page. global-error.tsx is the last-resort fallback for
// errors that happen even in this boundary / the root layout.
export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundary>
      <div className="route-error" role="alert">
        <div className="route-error-inner">
          <h1 className="route-error-title">StudySnap hit a snag</h1>
          <p className="route-error-copy">
            Something went wrong while loading this screen. Your notes are safe in your
            browser. Try reloading — if it keeps happening, sign out and back in.
          </p>
          {error?.digest ? (
            <p className="route-error-digest">Reference: {error.digest}</p>
          ) : null}
          <div className="route-error-actions">
            <button type="button" className="error-boundary-action" onClick={() => reset()}>
              Try again
            </button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}