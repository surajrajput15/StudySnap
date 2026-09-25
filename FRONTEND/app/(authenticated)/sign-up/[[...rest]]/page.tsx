'use client';

import { Suspense } from 'react';
import { SignUp, ClerkLoading, ClerkFailed } from '@clerk/nextjs';
import { Loader2, ShieldAlert } from 'lucide-react';

// Optional catch-all — mirrors app/sign-in/[[...rest]]/page.tsx so Clerk's
// OAuth transfer lands on a real route (/sign-up/sso-callback) instead of 404.
//
// Phase B P1: force post-auth landing to /app, with loading + failure states
// (see sign-in page for rationale).
export default function SignUpPage() {
  // NOTE: no Tailwind in this project — layout via inline style (dark slate).
  return (
    <main style={{ display: 'flex', minHeight: '100dvh', alignItems: 'center', justifyContent: 'center', background: '#020617', padding: '16px' }}>
      <Suspense
        fallback={
          <div className="signin-loading" role="status" aria-live="polite">
            <Loader2 size={28} className="tutor-spin" aria-hidden="true" />
            <p>Loading sign-up…</p>
          </div>
        }
      >
        <ClerkLoading>
          <div className="signin-loading" role="status" aria-live="polite">
            <Loader2 size={28} className="tutor-spin" aria-hidden="true" />
            <p>Loading sign-up…</p>
          </div>
        </ClerkLoading>
        <ClerkFailed>
          <div className="signin-failed" role="alert">
            <ShieldAlert size={28} aria-hidden="true" />
            <p>Sign-up could not load. Check your connection and reload the page.</p>
            <button type="button" className="md3-btn md3-btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </ClerkFailed>
        <SignUp forceRedirectUrl="/app" signInForceRedirectUrl="/app" />
      </Suspense>
    </main>
  );
}
