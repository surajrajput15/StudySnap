// Pass-through layout for the authenticated app shell.
// The root app/layout.tsx already provides <html>, <body>, ClerkProvider,
// JSON-LD, fonts, and global CSS. This layout exists so the app route
// group is explicit and future app-specific wrappers (e.g. auth guards,
// error boundaries) can be added here without touching the root layout.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
