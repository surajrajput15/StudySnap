'use client';

import dynamic from 'next/dynamic';
import { LogIn } from 'lucide-react';

const UserButton = dynamic(
  () => import('@clerk/nextjs').then((m) => m.UserButton),
  { ssr: false, loading: () => <span className="header-icon-btn" aria-hidden="true" style={{ width: 32, height: 32 }} /> }
);

const SignInButton = dynamic(
  () => import('@clerk/nextjs').then((m) => m.SignInButton),
  { ssr: false }
);

interface AuthButtonsProps {
  isSignedIn: boolean | undefined;
}

export default function AuthButtons({ isSignedIn }: AuthButtonsProps) {
  if (isSignedIn === undefined) {
    return null;
  }
  if (isSignedIn) {
    return <UserButton />;
  }
  return (
    <SignInButton mode="modal" forceRedirectUrl="/" signUpForceRedirectUrl="/">
      <button className="header-signin" type="button">
        <LogIn size={14} /> <span>Sign In</span>
      </button>
    </SignInButton>
  );
}
