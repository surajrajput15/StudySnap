import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import PwaRegister from "@/components/PwaRegister";
import ThemeSync from "@/components/ThemeSync";
import SessionExpiredModal from "@/components/SessionExpiredModal";
import ErrorToast from "@/components/ErrorToast";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudySnap - Smart Study Companion",
  description: "Create, organize, listen, and revise study notes with built-in AI help. Built by Suraj Bhan Pratap Singh, Full-Stack AI Engineer.",
  authors: [{ name: "Suraj Bhan Pratap Singh", url: "https://github.com/surajkumar" }],
  keywords: ["StudySnap", "AI Study Assistant", "Revision Mode", "PWA Study App", "Spaced Repetition", "Suraj Bhan Pratap Singh"],
  creator: "Suraj Bhan Pratap Singh",
  publisher: "Suraj Bhan Pratap Singh",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StudySnap",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0061A4",
  width: "device-width",
  initialScale: 1.0,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <meta name="author" content="Suraj Bhan Pratap Singh - Full-Stack AI Engineer" />
        </head>
        <body>
          <ThemeSync />
          <PwaRegister />
          <SessionExpiredModal />
          <ErrorToast />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
