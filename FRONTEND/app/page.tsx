import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AUTHOR_NAME, AUTHOR_JOB, SITE_URL } from "@/lib/marketing/constants";

export const metadata: Metadata = {
  title: "StudySnap — Your AI-powered Study Companion",
  description:
    "Capture, organize, listen to, and revise study notes with built-in AI. " +
    "Voice notes, spaced repetition, AI tutor, and offline-first PWA.",
  alternates: { canonical: SITE_URL },
};

// Inline SVG icons — avoids shipping lucide-react's client bundle on this
// zero-interactivity marketing route. Each icon is a small functional component.
type IconProps = { size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" };
const make = (path: React.ReactNode) =>
  function Icon({ size = 24, className, ...rest }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...rest}
      >
        {path}
      </svg>
    );
  };

const FileText = make(
  <>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
    <line x1="8" y1="9" x2="10" y2="9" />
  </>,
);
const Mic = make(
  <>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </>,
);
const Calendar = make(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </>,
);
const Trophy = make(
  <>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </>,
);
const BookOpen = make(
  <>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </>,
);
const Brain = make(
  <>
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </>,
);
const Shield = make(
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
);
const Zap = make(
  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
);
const ArrowRight = make(
  <>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </>,
);
const Check = make(
  <polyline points="20 6 9 17 4 12" />,
);

const features = [
  { Icon: FileText, title: "Smart Notes", desc: "Auto-save rich-text notes with categories, folders, and PIN lock." },
  { Icon: Mic, title: "Voice Notes", desc: "Record and transcribe lectures. Cloudinary-backed audio storage." },
  { Icon: Brain, title: "AI Tutor", desc: "Chat, summarize, generate MCQs and flashcards with Llama 3." },
  { Icon: Calendar, title: "Spaced Repetition", desc: "Schedule easy/medium/hard reviews to never forget." },
  { Icon: Trophy, title: "Gamification", desc: "Streaks, achievements, and milestones to keep you on track." },
  { Icon: BookOpen, title: "Offline-first", desc: "PWA with service worker — study anywhere, sync when online." },
];

const benefits = [
  "Free to use, no credit card required",
  "End-to-end encrypted sessions via Clerk",
  "Works offline, syncs across devices",
  "AI-powered learning, human-friendly UX",
];

export default function MarketingLanding() {
  return (
    <main className="marketing-root" aria-label="StudySnap — AI-powered study companion">
      <header className="marketing-nav">
        <div className="marketing-nav-inner">
          <Link href="/" className="marketing-brand" aria-label="StudySnap home">
            <Image src="/window.svg" alt="" width={32} height={32} priority />
            <span>StudySnap</span>
          </Link>
          <div className="marketing-nav-actions">
            <Link href="/sign-in" className="marketing-link">Sign in</Link>
            <Link href="/app" className="marketing-cta-primary">
              Launch app <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <section className="marketing-hero" aria-labelledby="hero-title">
        <div className="marketing-hero-inner">
          <span className="marketing-badge">
            <Zap size={14} /> AI-powered study companion
          </span>
          <h1 id="hero-title" className="marketing-title">
            Study smarter, <br />
            <span className="marketing-gradient">not harder.</span>
          </h1>
          <p className="marketing-subtitle">
            Capture lectures, organize notes, and let AI build your revision
            schedule. StudySnap is the offline-first PWA built for students
            who want to actually remember what they learn.
          </p>
          <div className="marketing-hero-actions">
            <Link href="/app" className="marketing-cta-primary marketing-cta-lg">
              Launch app — it&apos;s free <ArrowRight size={18} />
            </Link>
            <Link href="/sign-up" className="marketing-cta-secondary marketing-cta-lg">
              Create account
            </Link>
          </div>
          <ul className="marketing-benefits">
            {benefits.map((b) => (
              <li key={b}>
                <Check size={16} aria-hidden="true" /> <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="marketing-features" aria-labelledby="features-heading">
        <div className="marketing-features-inner">
          <h2 id="features-heading" className="marketing-section-title">
            Everything you need to study effectively
          </h2>
          <div className="marketing-feature-grid">
            {features.map((f) => {
              const Icon = f.Icon;
              return (
                <article key={f.title} className="marketing-feature-card">
                  <div className="marketing-feature-icon">
                    <Icon size={24} aria-hidden="true" />
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="marketing-trust" aria-labelledby="trust-heading">
        <div className="marketing-trust-inner">
          <Shield size={28} aria-hidden="true" />
          <h2 id="trust-heading">Built for privacy, designed for students</h2>
          <p>
            Authentication powered by Clerk. Notes synced over TLS to a
            serverless Postgres backend. Voice audio stored on Cloudinary.
            Built by {AUTHOR_NAME}, {AUTHOR_JOB}.
          </p>
        </div>
      </section>

      <footer className="marketing-footer">
        <div className="marketing-footer-inner">
          <p>© {new Date().getFullYear()} StudySnap. All rights reserved.</p>
          <nav aria-label="Footer">
            <Link href="/app">App</Link>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/sign-up">Sign up</Link>
            <a href="/sitemap.xml">Sitemap</a>
            <a href="/llms.txt">llms.txt</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
