'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useClerk } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

const FEATURES = [
  { icon: '✨', label: 'Generate Smart Summaries' },
  { icon: '🧠', label: 'Create Flashcards' },
  { icon: '❓', label: 'Generate MCQs' },
  { icon: '💡', label: 'Explain Difficult Topics' },
  { icon: '🌍', label: 'Translate Notes' },
  { icon: '📄', label: 'PDF AI' },
  { icon: '🗺', label: 'Mind Maps' },
  { icon: '📝', label: 'Revision Notes' },
];

export default function SignInPrompt() {
  const { openSignIn } = useClerk();
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const autoOpened = useRef(false);

  const doSignIn = useCallback(() => {
    if (isLoading) return;
    setIsLoading(true);
    setHasError(false);
    try {
      openSignIn({
        forceRedirectUrl: '/app?returnTo=ai',
        signUpForceRedirectUrl: '/app?returnTo=ai',
      });
    } catch {
      setHasError(true);
    }
    setTimeout(() => setIsLoading(false), 3000);
  }, [openSignIn, isLoading]);

  useEffect(() => {
    if (!autoOpened.current) {
      autoOpened.current = true;
      const timer = setTimeout(doSignIn, 600);
      return () => clearTimeout(timer);
    }
  }, [doSignIn]);

  return (
    <div className="signin-prompt-overlay">
      <div className="signin-prompt-card animate-fade-up">
        <div className="signin-prompt-glow" />
        <div className="signin-prompt-header">
          <div className="signin-prompt-icon">
            <span className="signin-prompt-icon-emoji">🔒</span>
          </div>
          <h2 className="signin-prompt-title">Unlock AI Study Assistant</h2>
          <p className="signin-prompt-desc">
            Sign in to unlock AI-powered study tools designed to help you learn faster, revise smarter, and stay productive.
          </p>
        </div>

        <div className="signin-prompt-grid">
          {FEATURES.map((feat, i) => (
            <div key={i} className="signin-prompt-grid-item">
              <span className="signin-prompt-grid-icon">{feat.icon}</span>
              <span className="signin-prompt-grid-label">{feat.label}</span>
            </div>
          ))}
        </div>

        <button
          className="signin-prompt-btn"
          onClick={doSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={20} className="tutor-spin" />
          ) : (
            <span className="signin-prompt-btn-icon">🚀</span>
          )}
          Sign In to Continue
        </button>

        {hasError && (
          <div className="signin-prompt-error">
            <span>⚠️</span> Could not open sign-in. Please try again.
          </div>
        )}

        <p className="signin-prompt-privacy">
          Your notes remain private and securely synced across your devices.
        </p>
      </div>
    </div>
  );
}
