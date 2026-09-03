'use client';

import dynamic from 'next/dynamic';
import { LogIn } from 'lucide-react';

const UserButton = dynamic(
  () => import('@clerk/nextjs').then((m) => m.UserButton),
  { ssr: false }
);

const SignInButton = dynamic(
  () => import('@clerk/nextjs').then((m) => m.SignInButton),
  { ssr: false }
);

interface AuthButtonsProps {
  isSignedIn: boolean | undefined;
}

export default function AuthButtons({ isSignedIn }: AuthButtonsProps) {
  return (
    <span className="auth-buttons-slot" aria-live="polite">
      {isSignedIn === undefined ? null : isSignedIn ? (
        <UserButton />
      ) : (
        <SignInButton mode="modal" forceRedirectUrl="/app" signUpForceRedirectUrl="/app">
          <button className="header-signin" type="button">
            <LogIn size={14} /> <span>Sign In</span>
          </button>
        </SignInButton>
      )}
    </span>
  );
}
