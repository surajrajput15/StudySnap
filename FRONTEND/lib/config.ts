const isBrowser = typeof window !== 'undefined';

function detectBackendURL(): string {
  // The backend URL must always be explicitly configured via env. On local
  // development we allow a localhost fallback so the app works out of the box.
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    // Never guess/derive a backend URL in production — silently pointing the
    // app at the wrong host is worse than clearly failing at runtime.
    if (isBrowser) {
      console.error(
        '[StudySnap] NEXT_PUBLIC_BACKEND_URL is not configured in this production build. ' +
          'API calls will fail, but the app can still run offline.'
      );
    }
    return 'http://localhost:4000';
  }
  if (isBrowser) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:4000';
    }
  }
  // Inlining localhost is a pure dev/fallback convenience; deployments must
  // provide NEXT_PUBLIC_BACKEND_URL explicitly.
  return 'http://localhost:4000';
}

const BACKEND_URL = detectBackendURL();

export const API = {
  base: BACKEND_URL,
  notes: `${BACKEND_URL}/api/notes`,
  categories: `${BACKEND_URL}/api/notes/categories`,
  voiceNotes: `${BACKEND_URL}/api/voice-notes`,
  ai: {
    chat: `${BACKEND_URL}/api/ai/chat`,
    summarize: `${BACKEND_URL}/api/ai/summarize`,
    mcqs: `${BACKEND_URL}/api/ai/mcqs`,
    translate: `${BACKEND_URL}/api/ai/translate`,
  },
  revision: {
    mark: `${BACKEND_URL}/api/revision/mark`,
    logs: `${BACKEND_URL}/api/revision/logs`,
  },
};

export interface ApiResponse {
  success?: boolean;
  error?: string;
  sessionExpired?: boolean;
  message?: { content?: string };
  response?: string;
  text?: string;
  /** HTTP status of the response (present only for actual HTTP round-trips). */
  status?: number;
  /** Server-provided delay (ms) before the caller may retry, parsed from the
   *  `Retry-After` response header. Absent when no header was sent. */
  retryAfterMs?: number;
  /** True when the request layer aborted on its own client-side timeout. */
  _timedOut?: boolean;
}

/** Parses the `Retry-After` header into milliseconds. Accepts either a
 *  delta-seconds value or the RFC 7231 HTTP-date form. Returns null for values
 *  that cannot be parsed so callers can fall back to default backoff. */
export function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

export async function apiFetch<T = ApiResponse>(
  url: string,
  options: RequestInit & { token?: string; returnTo?: string; timeoutMs?: number } = {}
): Promise<T> {
  const { token, returnTo, timeoutMs = 25000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
      ...fetchOptions,
      // Auth/JSON headers are merged BELOW the caller's headers so an options
      // object can never silently drop the Authorization or Content-Type.
      headers: { ...headers, ...(fetchOptions.headers as Record<string, string> || {}) },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('studysnap:session-expired', { detail: { returnTo } });
        window.dispatchEvent(event);
      }
      return {
        success: false,
        error: 'Your session has expired. Please sign in again.',
        sessionExpired: true,
        status: res.status,
      } as T;
    }

    const retryAfterMs = parseRetryAfterMs(res.headers?.get?.('retry-after') ?? null);
    // A gateway/CDN error page or an empty body is NOT JSON; falling back to {}
    // keeps `status` / `retryAfterMs` attached so sync layers still react to a
    // 429 and the error message stays useful.
    const json = await res.json().catch(() => ({}));

    // Preserve the exact JSON body contract while ADDITIVELY exposing the HTTP
    // status and any Retry-After hint, so sync layers can detect 429 throttling.
    return retryAfterMs !== null
      ? { ...json, status: res.status, retryAfterMs }
      : { ...json, status: res.status };

  } catch {
    if (controller.signal.aborted) {
      return { success: false, error: 'The request timed out. Please try again or make your question shorter.', _timedOut: true } as T;
    }

    return { success: false, error: 'We could not reach the server. Please check your connection and try again.' } as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Day 8 Task 1 (Phase 3) — multipart POST helper for voice-audio uploads.
 *
 * Deliberately separate from apiFetch so the JSON-only contract of apiFetch is
 * never violated: multipart bodies must NOT carry a `Content-Type: application/json`
 * header (the browser boundary is only correct when the header is left to
 * `fetch`). Failures mirror apiFetch's shape — the abort/timeout and the
 * generic network error — so sync callers can react uniformly, and a 401 still
 * broadcasts the shared session-expired event.
 */
export async function apiFetchMultipart<T = ApiResponse>(
  url: string,
  formData: FormData,
  options: { token?: string; returnTo?: string; timeoutMs?: number } = {}
): Promise<T> {
  const { token, returnTo, timeoutMs = 60000, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
      ...rest,
    });

    clearTimeout(timer);

    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('studysnap:session-expired', { detail: { returnTo } });
        window.dispatchEvent(event);
      }
      return {
        success: false,
        error: 'Your session has expired. Please sign in again.',
        sessionExpired: true,
        status: res.status,
      } as T;
    }

    const retryAfterMs = parseRetryAfterMs(res.headers?.get?.('retry-after') ?? null);
    const json = await res.json().catch(() => ({}));

    return retryAfterMs !== null
      ? { ...json, status: res.status, retryAfterMs }
      : { ...json, status: res.status };

  } catch {
    if (controller.signal.aborted) {
      return { success: false, error: 'The upload timed out. Please check your connection and try again.', _timedOut: true } as T;
    }

    return { success: false, error: 'We could not reach the server. Please check your connection and try again.' } as T;
  } finally {
    clearTimeout(timer);
  }
}
