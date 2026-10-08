import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import "./globals-base.css";
import {
  AUTHOR_NAME,
  AUTHOR_JOB,
  AUTHOR_FULL,
  AUTHOR_GITHUB,
  AUTHOR_PORTFOLIO,
  SITE_URL,
} from "@/lib/marketing/constants";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-hero",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-code",
  display: "swap",
});

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
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Phase B P2: pre-paint theme so dark users never flash light. Reads
            the guest-scope persisted theme (per-account keys are unknowable
            pre-hydration); falls back to the OS preference. Runs before any
            stylesheet so first paint already matches. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=null;try{var r=localStorage.getItem('studysnap-store');if(r){var s=JSON.parse(r);t=s&&s.state&&s.state.theme;}}catch(e){}if(t!=='light'&&t!=='dark'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#1a1c23':'#0061A4');}catch(e){}})();`,
          }}
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="author" content={AUTHOR_FULL} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body suppressHydrationWarning>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
