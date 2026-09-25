'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { Loader2, ShieldAlert, LogIn } from 'lucide-react';
import { useDialogFocus } from '@/lib/useDialogFocus';

// Phase B P1: session-expiry circuit breaker.
//
// Old behavior: every concurrent 401 re-opened the modal (last-write-wins
// returnTo race), the Sign In button re-enabled on a fixed 3s timer whether
// or not Clerk had finished, and dismissing ("Not Now") left the sync engine
// retrying against an expired token in a backoff loop with no way out.
//
// New behavior:
// - Deduped: session-expired events arriving while the modal is open are
//   ignored (the first returnTo wins instead of the last).
// - Auto-closes when Clerk reports signed-in again; loading resets then too.
// - Escape / backdrop click dismisses; focus is trapped + restored.
// - Loading timer is tracked and cleared on unmount / sign-in (no fixed lie).
export default function SessionExpiredModal() {
  const { openSignIn } = useClerk();
  const { isSignedIn } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [returnTo, setReturnTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const openRef = useRef(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    openRef.current = false;
    setIsOpen(false);
    setIsLoading(false);
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
  }, []);

  useDialogFocus(isOpen, panelRef, close);

  useEffect(() => {
    const handler = (event: Event) => {
      // Dedupe: concurrent 401s (notes + voice + AI) must not overwrite the
      // first returnTo or re-trigger the open animation.
      if (openRef.current) return;
      openRef.current = true;
      const detail = (event as CustomEvent<{ returnTo?: string }>).detail || {};
      setReturnTo(
        detail.returnTo === 'ai'
          ? '/app?returnTo=ai'
          : `${window.location.pathname}${window.location.search}`
      );
      setIsOpen(true);
    };
    window.addEventListener('studysnap:session-expired', handler);
    return () => window.removeEventListener('studysnap:session-expired', handler);
  }, []);

  // Re-sign-in completed (possibly in another tab): close + reset instead of
  // leaving a stale modal on top of a working session.
  useEffect(() => {
    if (isSignedIn && openRef.current) close();
  }, [isSignedIn, close]);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, []);

  const handleSignIn = () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      openSignIn({ forceRedirectUrl: returnTo, signUpForceRedirectUrl: returnTo });
    } catch {
      setIsLoading(false);
      return;
    }
    // Fallback: if the Clerk modal is dismissed without signing in, re-enable
    // the button. Cleared on unmount and on successful sign-in (above).
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => {
      loadingTimerRef.current = null;
      if (openRef.current) setIsLoading(false);
    }, 5000);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        ref={panelRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="session-expired-body">
          <div className="session-expired-icon">
            <ShieldAlert size={26} />
          </div>
          <h3 id="session-expired-title" className="session-expired-title">Session Expired</h3>
          <p className="session-expired-desc">
            Your session has expired. Sign in again to continue where you left off.
          </p>
          <div className="session-expired-actions">
            <button className="session-expired-btn" onClick={handleSignIn} disabled={isLoading}>
              {isLoading ? <Loader2 size={18} className="tutor-spin" /> : <LogIn size={18} />}
              Sign In Again
            </button>
            <button className="session-expired-dismiss" onClick={close}>
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
