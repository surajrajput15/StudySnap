import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/PwaRegister";
import ThemeSync from "@/components/ThemeSync";
import "./globals-base.css";
import {
  AUTHOR_NAME,
  AUTHOR_JOB,
  AUTHOR_FULL,
  AUTHOR_GITHUB,
  AUTHOR_PORTFOLIO,
  SITE_URL,
} from "@/lib/marketing/constants";

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
    canonical: SITE_URL,
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
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="author" content={AUTHOR_FULL} />
        <link rel="preconnect" href="https://clerk.accounts.dev" crossOrigin="anonymous" />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_BACKEND_URL || "https://studysnap-backend.onrender.com"} crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        <ThemeSync />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
