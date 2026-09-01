import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import PwaRegister from "@/components/PwaRegister";
import ThemeSync from "@/components/ThemeSync";
import SessionExpiredModal from "@/components/SessionExpiredModal";
import ErrorToast from "@/components/ErrorToast";
import "./globals.css";

// Single source of truth for author identity — keep EXACTLY consistent across
// GitHub, Vercel, package.json, README, docs, and JSON-LD (E-E-A-T).
const AUTHOR_NAME = "Suraj Bhan Pratap Singh";
const AUTHOR_JOB = "Full-Stack AI Engineer";
const AUTHOR_FULL = `${AUTHOR_NAME} - ${AUTHOR_JOB}`;
const AUTHOR_GITHUB = "https://github.com/surajkumar";
const AUTHOR_PORTFOLIO = "https://surajbhan-15.vercel.app/";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://studysnap-sigma.vercel.app";

export const metadata: Metadata = {
  title: "StudySnap - Smart Study Companion",
  description: "Create, organize, listen, and revise study notes with built-in AI help. Built by Suraj Bhan Pratap Singh, Full-Stack AI Engineer.",
  authors: [{ name: AUTHOR_FULL, url: AUTHOR_GITHUB }],
  keywords: ["StudySnap", "AI Study Assistant", "Revision Mode", "PWA Study App", "Spaced Repetition", "Suraj Bhan Pratap Singh"],
  creator: AUTHOR_FULL,
  publisher: AUTHOR_FULL,
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
  alternates: {
    canonical: "/",
  },
  verification: {
    google: "JShkc5ukY_Gw4mTItEeE8lb8pUurWNxzJ9jLGVCm4XE",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "StudySnap",
    title: "StudySnap - Smart Study Companion",
    description: "Create, organize, listen, and revise study notes with built-in AI help.",
  },
  twitter: {
    card: "summary_large_image",
    title: "StudySnap - Smart Study Companion",
    description: "Create, organize, listen, and revise study notes with built-in AI help.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "StudySnap",
      description: "AI-powered study companion for notes, voice transcription, and spaced repetition.",
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "StudySnap",
      url: SITE_URL,
      logo: `${SITE_URL}/studysnap-logo.svg`,
      sameAs: [AUTHOR_GITHUB, AUTHOR_PORTFOLIO],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "StudySnap",
      operatingSystem: "Web, PWA",
      applicationCategory: "EducationalApplication",
      description: "Capture, structure, listen to, and revise study notes with AI.",
      url: SITE_URL,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: { "@id": `${SITE_URL}/#person` },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#person`,
      name: AUTHOR_NAME,
      jobTitle: AUTHOR_JOB,
      url: AUTHOR_GITHUB,
      sameAs: [AUTHOR_GITHUB, AUTHOR_PORTFOLIO],
      worksFor: { "@id": `${SITE_URL}/#organization` },
    },
  ],
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
          <meta name="author" content={AUTHOR_FULL} />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          />
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
