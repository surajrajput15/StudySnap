// Day 15 Tasks 3/4/6 — client-side observability primitives.
//
// This is the ONLY place the app listens for global client failures:
//   - uncaught exceptions    → window 'error'
//   - unhandled rejections   → window 'unhandledrejection'
//   - declared crash reports → the 'studysnap:crash' CustomEvent (dispatched by
//     ErrorBoundary / app error.tsx)
//
// There is no telemetry SDK in this build; structured console output is the
// production visibility channel (Vercel captures stdout). Keeping every global
// crash in one place means adding a real analytics/error service later is a
// single-file change.

const CRASH_EVENT = 'studysnap:crash';
const ERROR_TOAST_EVENT = 'studysnap:error';

/** Formats an uncaught-error event into a compact, greppable log line. */
export function describeUncaughtError(event: ErrorEvent): string {
  const message = event.message || 'Unknown script error';
  const where = event.filename
    ? `${event.filename}${event.lineno ? `:${event.lineno}${event.colno ? `:${event.colno}` : ''}` : ''}`
    : 'unknown location';
  return `${message} @ ${where}`;
}

/** Formats an unhandled-rejection event into a compact, greppable log line. */
export function describeUnhandledRejection(reason: unknown): string {
  if (reason instanceof Error) return reason.stack || reason.message;
  return `Non-Error rejection: ${JSON.stringify(reason)}`;
}

/**
 * Registers the global failure listeners. Idempotent — safe to call from any
 * mount point (layout or ErrorToast). Returns an unsubscribe function.
 */
export function initClientCrashLogging(): () => void {
  if (typeof window === 'undefined') return () => {};

  const onError = (event: ErrorEvent) => {
    console.error('[studysnap:crash] uncaught exception —', describeUncaughtError(event));
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error('[studysnap:crash] unhandled rejection —', describeUnhandledRejection(event.reason));
  };
  const onDeclaredCrash = (event: Event) => {
    const detail = (event as CustomEvent).detail as { message?: string; componentStack?: string } | undefined;
    console.error('[studysnap:crash] component boundary —', detail?.message || 'unknown', detail?.componentStack || '');
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  window.addEventListener(CRASH_EVENT, onDeclaredCrash);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    window.removeEventListener(CRASH_EVENT, onDeclaredCrash);
  };
}

/**
 * Surfaces a user-facing error through the shared toast channel instead of a
 * native alert() / divergent inline copy. Fires the same channel the
 * ErrorToast component renders from.
 */
export function notifyError(message: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ERROR_TOAST_EVENT, { detail: { message } }));
}

export { CRASH_EVENT, ERROR_TOAST_EVENT };
