import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * Proxy-mode live keys REQUIRE the app to serve Clerk's Frontend API under
 * `/__clerk/*` (the production publishable key decodes to
 * `clerk.studysnap-sigma.vercel.app$` — trailing `$` = proxy mode). Clerk only
 * AUTO-enables this on *.vercel.app hosts, so it is pinned here explicitly:
 * sign-in breaks with 404s on any other host otherwise. Harmless with test
 * keys — the browser SDK never calls /__clerk outside proxy mode.
 */
export default clerkMiddleware({ frontendApiProxy: { enabled: true } });

export const config = {
  // '/__clerk/:path*' MUST come first and stand alone: the generic pattern
  // excludes dotted paths (static-file optimisation), but proxy mode serves
  // Clerk's JS bundles under /__clerk/npm/@clerk/*.js — without this entry
  // those requests skip the middleware entirely and die as Next 404 HTML
  // pages ("MIME type 'text/html' is not executable" in the browser).
  matcher: ['/__clerk/:path*', '/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
