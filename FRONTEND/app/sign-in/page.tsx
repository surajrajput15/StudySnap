import { SignIn } from '@clerk/nextjs';

// Dedicated full-page sign-in route. The home page uses modal-based
// <SignInButton mode="modal">, but Clerk's component paths (Configure →
// Paths) still need a real URL to land users on after external OAuth
// redirects (Google) complete via /__clerk/v1/oauth_callback. Without it
// the instance fell back to the Account Portal subdomain, which does not
// exist on Vercel (ERR_CONNECTION_CLOSED).
export default function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
      <SignIn />
    </main>
  );
}
