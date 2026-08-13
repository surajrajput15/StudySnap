/**
 * Day 8 Task 4 (Phase A) — Production Content-Security-Policy for the Next.js
 * browser pages.
 *
 * The backend already serves JSON responses with a CSP (BACKEND middleware/
 * security.ts), but browser PAGES are served by the Next.js frontend, which
 * previously sent NO CSP header (only X-Frame-Options, X-Content-Type-Options
 * and Referrer-Policy). This module builds the page header that next.config.ts
 * attaches so the actual pages are protected against XSS / injection.
 *
 * Approach — the Next.js-sanctioned "Without Nonces" route (see
 * node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md): the
 * header is attached statically via next.config `headers()`, so pages keep
 * static/SSR rendering and no proxy/nonce middleware is introduced.
 *
 * Deliberate allowances:
 *  - `'unsafe-inline'` (scripts AND styles) is kept because the Next.js App
 *    Router streams inline bootstrap scripts and the components rely on inline
 *    `style={{...}}` attributes (framer-motion, KaTeX, dynamic progress bars).
 *    Removing it would require nonces the current architecture does not use.
 *  - `'unsafe-eval'` is NEVER allowed: neither Next.js nor React use eval in
 *    production, and jspdf's only "Function(" occurrence is the
 *    `headerFunction` method name, not `new Function`.
 *  - No broad `https://*` or `*` sources — every external origin below is a
 *    concrete service-owned origin actually used by the running app (Clerk
 *    scripts / Frontend API / avatars, Cloudinary audio, Google Fonts, and the
 *    configured backend API origin).
 */

export interface ProductionCspOptions {
  /** Cross-origin backend API origin (derived from NEXT_PUBLIC_BACKEND_URL).
   *  When null the header omits it rather than fabricating a host the config
   *  audibly rejects at runtime anyway. */
  backendOrigin: string | null;
}

/** Normalizes a configured URL/URL-with-path into its canonical bare origin, or
 *  null when absent/invalid so the CSP never emits a garbage source. */
export function originOf(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function connectSrcFor(backendOrigin: string | null): string {
  const sources = [
    "'self'",
    'https://js.clerk.com',
    'https://*.clerk.com',
    'https://*.clerk.accounts.dev',
    'https://clerk-telemetry.com',
    'https://*.clerk-telemetry.com',
  ];
  if (backendOrigin) sources.push(backendOrigin);
  return `connect-src ${sources.join(' ')}`;
}

/** Serializes the complete production page CSP. No `*`/`https://*` wildcards,
 *  no `'unsafe-eval'`; only concrete origins required by the running app. */
export function buildProductionCspHeader(options: ProductionCspOptions): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.com",
    "img-src 'self' data: blob: https://img.clerk.com https: http:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "media-src 'self' blob: https://res.cloudinary.com",
    connectSrcFor(options.backendOrigin),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    'upgrade-insecure-requests',
  ];
  return directives.join('; ');
}