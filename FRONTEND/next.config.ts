import type { NextConfig } from "next";
import { buildProductionCspHeader, originOf } from "./lib/security/csp";

// Day 8 Task 4 (Phase A) — production Content-Security-Policy for the actual
// browser pages. Attached ONLY for production builds: Next dev tooling needs a
// permissive policy (HMR websockets + React eval debugging) and already runs
// without a CSP header. The policy is built by lib/security/csp.ts so it can be
// statically verified by tests, and it allows exactly the required resources:
// the frontend origin ('self'), the configured backend API origin, Clerk, and
// Cloudinary audio.
// Day 10 Task 1 — production fail-fast for the one env the CSP depends on.
// Without NEXT_PUBLIC_BACKEND_URL the emitted connect-src omits the API origin
// while lib/config.ts keeps calling http://localhost:4000, so every request is
// silently blocked by the browser with only a console warning — the app looks
// fine but never syncs. Mirroring the backend's fail-fast rule (see
// BACKEND/src/config/env.ts), a production build ABORTS instead of shipping a
// build whose API calls are guaranteed to be CSP-blocked.
function resolveProductionCspHeader(): string {
  if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
    throw new Error(
      "[StudySnap] ❌ Production build aborted — NEXT_PUBLIC_BACKEND_URL is not set. " +
        "Without it the Content-Security-Policy cannot allow the API origin and every " +
        "request would be blocked. Set it to your backend URL (e.g. https://<backend>.railway.app)."
    );
  }
  const backendOrigin = originOf(process.env.NEXT_PUBLIC_BACKEND_URL);
  if (!backendOrigin) {
    throw new Error(
      `[StudySnap] ❌ Production build aborted — NEXT_PUBLIC_BACKEND_URL ("${process.env.NEXT_PUBLIC_BACKEND_URL}") is not a valid URL.`
    );
  }
  return buildProductionCspHeader({ backendOrigin });
}

const productionCspHeader =
  process.env.NODE_ENV === "production" ? resolveProductionCspHeader() : null;

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          ...(productionCspHeader
            ? [{ key: 'Content-Security-Policy', value: productionCspHeader }]
            : []),
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Cache-Control', value: 'no-cache' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ];
  },
};

export default nextConfig;
