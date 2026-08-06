'use client';

import { useEffect, useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import { Loader2, ShieldAlert, LogIn } from 'lucide-react';

export default function SessionExpiredModal() {
  const { openSignIn } = useClerk();
  const [isOpen, setIsOpen] = useState(false);
  const [returnTo, setReturnTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ returnTo?: string }>).detail || {};
      setReturnTo(
        detail.returnTo === 'ai'
          ? '/?returnTo=ai'
          : `${window.location.pathname}${window.location.search}`
      );
      setIsOpen(true);
    };
    window.addEventListener('studysnap:session-expired', handler);
    return () => window.removeEventListener('studysnap:session-expired', handler);
  }, []);

  const handleSignIn = () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      openSignIn({ forceRedirectUrl: returnTo, signUpForceRedirectUrl: returnTo });
    } finally {
      setTimeout(() => setIsLoading(false), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="session-expired-title">
      <div className="modal-content">
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
            <button className="session-expired-dismiss" onClick={() => setIsOpen(false)}>
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
