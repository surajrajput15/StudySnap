import { createFrontendApiProxyHandlers } from '@clerk/nextjs/server';

/**
 * Clerk Frontend API proxy (proxy-mode live keys).
 *
 * The production publishable key decodes to `clerk.studysnap-sigma.vercel.app$`
 * — the trailing `$` marks PROXY MODE, which Clerk requires on *.vercel.app
 * hosts because CNAME records cannot be added to Vercel's public suffix.
 * In proxy mode every browser auth call goes to `<origin>/__clerk/*` and MUST
 * be forwarded to Clerk's Frontend API by this catch-all handler; without it
 * the routes fall through to the SPA and every sign-in/session request 404s.
 * Test keys (local dev) never use the proxy, so this route is inert there.
 */
export const { GET, POST, PUT, DELETE, PATCH } = createFrontendApiProxyHandlers();
