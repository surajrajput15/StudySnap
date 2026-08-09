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
      headers: { ...headers, ...(fetchOptions.headers as Record<string, string> || {}) },
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.status === 401) {
      const event = new CustomEvent('studysnap:session-expired', { detail: { returnTo } });
      window.dispatchEvent(event);
      return { success: false, error: 'Your session has expired. Please sign in again.', sessionExpired: true } as T;
    }

    const json = await res.json();

    return json;
  } catch {
    if (controller.signal.aborted) {
      return { success: false, error: 'The request timed out. Please try again or make your question shorter.', _timedOut: true } as T;
    }

    return { success: false, error: 'We could not reach the server. Please check your connection and try again.' } as T;
  } finally {
    clearTimeout(timer);
  }
}
