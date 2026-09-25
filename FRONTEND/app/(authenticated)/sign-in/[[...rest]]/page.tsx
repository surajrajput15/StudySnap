'use client';

import { Suspense } from 'react';
import { SignIn, ClerkLoading, ClerkFailed } from '@clerk/nextjs';
import { Loader2, ShieldAlert } from 'lucide-react';

// Optional catch-all — Clerk's OAuth flow navigates to
// /sign-in/sso-callback (sign-in path + Clerk's fixed suffix) to consume the
// account-transfer token after an external provider (Google) redirect. A flat
// page.tsx 404s there; [[...rest]] serves both /sign-in and the callback path.
//
// Phase B P1: force post-auth landing to /app (Clerk's default would drop the
// user on the marketing page), with a loading skeleton while the Clerk JS
// loads and an explicit failure state when it cannot (offline/blocked).
export default function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
      <Suspense
        fallback={
          <div className="signin-loading" role="status" aria-live="polite">
            <Loader2 size={28} className="tutor-spin" aria-hidden="true" />
            <p>Loading sign-in…</p>
          </div>
        }
      >
        <ClerkLoading>
          <div className="signin-loading" role="status" aria-live="polite">
            <Loader2 size={28} className="tutor-spin" aria-hidden="true" />
            <p>Loading sign-in…</p>
          </div>
        </ClerkLoading>
        <ClerkFailed>
          <div className="signin-failed" role="alert">
            <ShieldAlert size={28} aria-hidden="true" />
            <p>Sign-in could not load. Check your connection and reload the page.</p>
            <button type="button" className="md3-btn md3-btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </ClerkFailed>
        <SignIn forceRedirectUrl="/app" signUpForceRedirectUrl="/app" />
      </Suspense>
    </main>
  );
}
