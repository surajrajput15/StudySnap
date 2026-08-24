import { SignUp } from '@clerk/nextjs';

// Dedicated full-page sign-up route — see app/sign-in/page.tsx for why
// this exists alongside the modal-based flow on the home page.
export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
      <SignUp />
    </main>
  );
}
