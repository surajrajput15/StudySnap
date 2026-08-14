'use client';

// Day 15 Task 1 — last-resort boundary. This must include its own <html>/<body>
// because it replaces the root layout entirely when even the layout crashed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('[studysnap] fatal error (global-error):', error);
  return (
    <html lang="en">
      <body>
        <div className="route-error" role="alert">
          <div className="route-error-inner">
            <h1 className="route-error-title">StudySnap hit a snag</h1>
            <p className="route-error-copy">
              Something went wrong at the app level. Your notes are safe in your browser —
              reload to continue.
            </p>
            <div className="route-error-actions">
              <button type="button" className="error-boundary-action" onClick={() => reset()}>
                Try again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}