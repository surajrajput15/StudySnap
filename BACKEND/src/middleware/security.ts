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

const PRODUCTION_ORIGINS = ['https://studysnap-sigma.vercel.app'] as const;

const DEVELOPMENT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'] as const;

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

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Non-browser / server-to-server callers (Clerk webhooks, health checks,
    // cron jobs) send no Origin header and must keep working.
    if (!origin) return callback(null, true);
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
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
});
