import type { NextConfig } from "next";
import { buildProductionCspHeader, originOf } from "./lib/security/csp";

// Day 8 Task 4 (Phase A) — production Content-Security-Policy for the actual
// browser pages. Attached ONLY for production builds: Next dev tooling needs a
// permissive policy (HMR websockets + React eval debugging) and already runs
// without a CSP header. The policy is built by lib/security/csp.ts so it can be
// statically verified by tests, and it allows exactly the required resources:
// the frontend origin ('self'), the configured backend API origin, Clerk, and
// Cloudinary audio.
const productionCspHeader =
  process.env.NODE_ENV === "production"
    ? buildProductionCspHeader({ backendOrigin: originOf(process.env.NEXT_PUBLIC_BACKEND_URL) })
    : null;

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
