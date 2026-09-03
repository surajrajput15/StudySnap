import { ClerkProvider } from "@clerk/nextjs";
import SessionExpiredModal from "@/components/SessionExpiredModal";
import ErrorToast from "@/components/ErrorToast";
import "../globals.css";

// Authenticated route group — wraps /app, /sign-in, /sign-up with ClerkProvider
// and the full app stylesheet. The root layout only loads globals-base.css
// (CSS variables, reset, body), so the marketing landing at / stays light.
// The full globals.css is loaded here for the app shell, sign-in, sign-up.
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
