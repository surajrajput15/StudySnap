// Pass-through layout for the authenticated app shell.
// The root app/layout.tsx provides <html>, <body>, metadata/JSON-LD and
// globals-base.css; app/(authenticated)/layout.tsx provides ClerkProvider,
// session/error modals and globals.css. This layout exists so the app route
// group is explicit and future app-specific wrappers (e.g. auth guards,
// error boundaries) can be added here without touching the other layouts.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
