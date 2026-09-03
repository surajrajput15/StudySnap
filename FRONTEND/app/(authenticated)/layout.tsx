import { ClerkProvider } from "@clerk/nextjs";
import SessionExpiredModal from "@/components/SessionExpiredModal";
import ErrorToast from "@/components/ErrorToast";

// Authenticated route group — wraps /app, /sign-in, /sign-up with ClerkProvider.
// The root app/layout.tsx does NOT include ClerkProvider, so the marketing
// landing at / stays free of Clerk's client runtime and third-party cookies
// (the main mobile performance win).
//
// SessionExpiredModal and ErrorToast also need to live under ClerkProvider
// (they call useUser/useAuth internally), so they move here too.
export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <SessionExpiredModal />
      <ErrorToast />
      {children}
    </ClerkProvider>
  );
}
