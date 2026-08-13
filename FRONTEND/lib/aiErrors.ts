// Day 9 Task 17 — differentiated SnapAI error handling.
//
// Previously every AI failure collapsed into a handful of ad-hoc string checks
// inside the component, so a 5xx, a rate limit, an oversized request and a plain
// network drop all surfaced roughly the same generic bubble. These pure helpers
// classify a failure by what's actually known (HTTP status, Retry-After hint,
// offline flag, message text) and produce a distinct, user-friendly message per
// cause. Kept DOM-free and fetch-free so it is unit-testable.

export type AiFailureKind =
  | 'offline'
  | 'network'
  | 'timeout'
  | 'rateLimited'
  | 'auth'
  | 'server'
  | 'badRequest'
  | 'invalidResponse'
  | 'generic';

export interface AiErrorContext {
  /** Browser-reported connectivity (navigator.onLine inverted). */
  isOffline?: boolean;
  /** HTTP status of the failed response, when one exists. */
  status?: number | null;
  /** Server-provided Retry-After hint (ms), when one exists. */
  retryAfterMs?: number | null;
  /** Error text from the request layer or thrown exception. */
  message?: string | null;
  /** True when the request layer aborted due to its own timeout. */
  timedOut?: boolean;
}

function hasText(message: string | null | undefined, needles: string[]): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

/** Maps a failure to one of the known SnapAI failure kinds. */
export function classifyAiError(ctx: AiErrorContext): AiFailureKind {
  const { isOffline, status, retryAfterMs, message, timedOut } = ctx;

  if (isOffline) return 'offline';

  if (retryAfterMs != null && retryAfterMs > 0) return 'rateLimited';
  if (status === 429) return 'rateLimited';
  if (hasText(message, ['rate limit', 'rate-limited', 'ratelimit', 'throttled', 'quota'])) {
    return 'rateLimited';
  }

  if (status === 401) return 'auth';
  if (hasText(message, ['authentication required', '401', 'invalid or expired session', 'session has expired', 'session expired'])) {
    return 'auth';
  }

  if (status !== null && status !== undefined && status >= 500) return 'server';
  if (hasText(message, ['internal server', 'server error', 'service unavailable', 'bad gateway'])) {
    return 'server';
  }

  if (status !== null && status !== undefined && status >= 400) return 'badRequest';

  if (timedOut) return 'timeout';
  if (hasText(message, ['timed out', 'timed-out', 'request timeout', 'timeout exceeded'])) {
    return 'timeout';
  }

  if (
    hasText(message, [
      'fetch failed',
      'failed to fetch',
      'network', 'connection', 'unreachable', 'could not reach', 'cors', 'cross-origin',
      'econn', 'enetunreach', 'getaddrinfo',
    ])
  ) {
    return 'network';
  }

  if (!status && !retryAfterMs && !message) return 'invalidResponse';

  return 'generic';
}

export const AI_ERROR_MESSAGES: Record<AiFailureKind, string> = {
  offline: "You're offline. Connect to the internet to continue chatting with SnapAI.",
  network: "Couldn't reach the AI service. Check your internet connection and try again.",
  timeout: 'The AI took too long to respond. Try a shorter or simpler question.',
  rateLimited: 'SnapAI is busy right now. Please wait a moment and try again.',
  auth: 'Your session ended. Please sign in again to continue chatting with SnapAI.',
  server: 'The AI service hit a temporary error. Please try again in a moment.',
  badRequest: "That request was too large or couldn't be processed. Try shortening the material.",
  invalidResponse: 'SnapAI returned an unexpected response. Please try again.',
  generic: 'Something went wrong. Please try again or rephrase your question.',
};

/** Renders the user-facing message, adding a concrete retry hint when known. */
export function aiErrorMessage(kind: AiFailureKind, retryAfterMs?: number | null): string {
  const base = AI_ERROR_MESSAGES[kind];
  if (kind === 'rateLimited' && retryAfterMs && retryAfterMs > 0) {
    const seconds = Math.ceil(retryAfterMs / 1000);
    return `${base} You can retry in about ${seconds} second${seconds === 1 ? '' : 's'}.`;
  }
  return base;
}