import { SignIn } from '@clerk/nextjs';

// Optional catch-all — Clerk's OAuth flow navigates to
// /sign-in/sso-callback (sign-in path + Clerk's fixed suffix) to consume the
// account-transfer token after an external provider (Google) redirect. A flat
// page.tsx 404s there; [[...rest]] serves both /sign-in and the callback path.
export default function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
      <SignIn />
    </main>
  );
}
