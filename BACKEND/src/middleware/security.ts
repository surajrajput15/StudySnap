import helmet from 'helmet';
import cors from 'cors';
import { env } from '../config/env';

const prodCSP = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    'https://*.clerk.accounts.dev',
    'https://*.clerk.com',
    'https://js.clerk.com',
  ],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://*.clerk.com'],
  imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
  fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
  connectSrc: [
    "'self'",
    'https://*.clerk.accounts.dev',
    'https://*.clerk.com',
    'https://*',
    'http://localhost:4000',
  ],
  mediaSrc: ["'self'", 'blob:', 'https://res.cloudinary.com'],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  frameAncestors: ["'self'"],
  formAction: ["'self'"],
};

export const securityMiddleware = helmet({
  contentSecurityPolicy: env.isProd() ? { directives: prodCSP } : false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
});

// ─── CORS ──────────────────────────────────────────────────────────────
// Day 8 Task 2 Phase 1 (B-3) — exact-origin validation.
//
// The previous matcher allowed any origin whose string merely CONTAINED
// "localhost" (e.g. https://localhost.evil.com) via substring comparison.
// Origins are now compared EXACTLY (scheme://host[:port]) after URL
// normalization. No substring, prefix, suffix, or partial-domain matching
// is performed anywhere.

const PRODUCTION_ORIGINS = [
  'https://studysnap-sigma.vercel.app',
  'https://studysnap.vercel.app',
] as const;

const DEVELOPMENT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'] as const;

/**
 * True when the origin hostname ends in `.vercel.app` (exact hostname suffix
 * match — never a substring/prefix match on the full origin). `vercel.app` is a
 * public suffix controlled by Vercel, so arbitrary sites cannot register a
 * subdomain of it; this safely admits Vercel PR/preview deploys
 * (`<project>-git-<branch>-<owner>.vercel.app`) and the canonical Vercel domain
 * without reopening the old `localhost.evil.com`-style spoof.
 */
function isVercelPreviewOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'vercel.app' || host.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

/** Exported for the CORS unit tests. */
export { isVercelPreviewOrigin };

/**
 * Exact hostname equality used ONLY to detect a local-development host in a
 * configured value. This is a single hostname comparison — never substring /
 * partial-host matching — so production can never honor a leftover
 * FRONTEND_URL that still points at localhost.
 */
function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

/** Normalizes a browser `Origin` header value to its canonical form. Real
 *  browsers only ever send scheme://host[:port]; crafted values that carry a
 *  path, query string, or trailing slash are reduced so they still compare as
 *  exact host-level identities. Invalid values are returned unchanged (and so
 *  simply fail the allow-list). */
export function normalizeOrigin(origin: string): string {
  try {
    return new URL(origin).origin;
  } catch {
    return origin;
  }
}

/** Exact-origin allow-list check. Never matches on substrings/partial hosts. */
export function isOriginAllowed(origin: string, allowedOrigins: readonly string[]): boolean {
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.some((o) => normalizeOrigin(o) === normalized);
}

// env.FRONTEND_URL is the primary configured origin (honored in every mode),
// but in production a value that still names a local-development host is
// ignored: only explicitly trusted production origins may be allowed.
const configuredOrigins =
  env.FRONTEND_URL && (!env.isProd() || !isLocalDevelopmentOrigin(env.FRONTEND_URL))
    ? [env.FRONTEND_URL]
    : [];

const environmentOrigins = env.isProd() ? PRODUCTION_ORIGINS : DEVELOPMENT_ORIGINS;
const corsOrigins = [...new Set([...configuredOrigins, ...environmentOrigins])].filter(Boolean);

console.log(`[cors] ${env.isProd() ? 'PRODUCTION' : 'DEV'} allowed origins:`, corsOrigins);

// ─── Rate-limit response visibility (Day 8 Task 4 Phase B) ──────────────
// express-rate-limit (v7) is configured with `standardHeaders: true` (draft-6)
// and `legacyHeaders: false`, so every response carries `RateLimit-Policy` /
// `RateLimit-Limit` / `RateLimit-Remaining` / `RateLimit-Reset` and every 429
// carries `Retry-After`. `Retry-After` is NOT a CORS-safelisted response
// header, so without explicit exposure a browser's fetch() can never read it
// and the frontend sync engine silently falls back to its own backoff. Expose
// exactly the headers the middleware actually emits so the
// 429 → Retry-After → apiFetch → syncEngine chain works end-to-end.
export const CORS_EXPOSED_HEADERS = [
  'Retry-After',
  'RateLimit-Policy',
  'RateLimit-Limit',
  'RateLimit-Remaining',
  'RateLimit-Reset',
] as const;

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Non-browser / server-to-server callers (Clerk webhooks, health checks,
    // cron jobs) send no Origin header and must keep working.
    if (!origin) return callback(null, true);
    // Vercel PR/preview deployments share the production backend; their
    // generated `<project>-git-<branch>-<owner>.vercel.app` hosts can never be
    // listed up front, so the safe `.vercel.app` suffix is honored here.
    if (env.isProd() && isVercelPreviewOrigin(origin)) {
      return callback(null, true);
    }
    if (isOriginAllowed(origin, corsOrigins)) {
      callback(null, true);
    } else {
      console.warn(`[cors] Blocked origin: ${normalizeOrigin(origin)}. Allowed:`, corsOrigins);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [...CORS_EXPOSED_HEADERS],
});
