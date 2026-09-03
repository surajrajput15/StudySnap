import { SignUp } from '@clerk/nextjs';

// Optional catch-all — mirrors app/sign-in/[[...rest]]/page.tsx so Clerk's
// OAuth transfer lands on a real route (/sign-up/sso-callback) instead of 404.
export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
      <SignUp />
    </main>
  );
}
