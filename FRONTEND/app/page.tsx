import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./marketing.css";
import { AUTHOR_NAME, AUTHOR_JOB, SITE_URL } from "@/lib/marketing/constants";

export const metadata: Metadata = {
  title: "StudySnap — Study smarter, not harder",
  description:
    "Capture lectures, organize notes, and use AI to turn what you learn " +
    "into a smarter revision workflow. Free, offline-first study companion.",
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
const Wifi = make(
  <>
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </>,
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

const benefits = [
  "Free to use",
  "Secure authentication",
  "Works across devices",
  "AI-powered learning tools",
  "Offline-first workflow",
];

const features = [
  { Icon: FileText, title: "Smart Notes", desc: "Rich-text notes with subjects, folders, tags, and PIN lock for sensitive pages." },
  { Icon: Mic, title: "Voice Notes", desc: "Record lectures and get transcripts you can search, review, and study from." },
  { Icon: Brain, title: "AI Tutor", desc: "Summaries, MCQs, flashcards, quizzes, and explanations from your own material." },
  { Icon: Calendar, title: "Spaced Repetition", desc: "Easy / medium / hard review scheduling, so revision happens on time." },
  { Icon: Trophy, title: "Gamification", desc: "Study streaks, achievements, and milestones that reward showing up daily." },
  { Icon: Wifi, title: "Offline-first", desc: "A PWA that keeps working without a perfect connection and syncs when you're back online." },
];

const steps = [
  { n: "01", title: "Capture", desc: "Create notes, record lectures, or add the study material you're working with." },
  { n: "02", title: "Understand", desc: "Use StudySnap AI to summarize, explain, and generate study material from it." },
  { n: "03", title: "Revise", desc: "Organize everything into subjects and folders, and follow your revision workflow." },
];

const aiCapabilities = [
  "Summaries",
  "MCQs",
  "Flashcards",
  "Quizzes",
  "Mind Maps",
  "Translation",
  "Explain",
  "PDF AI",
];

export default function MarketingLanding() {
  return (
    <main className="marketing-root" aria-label="StudySnap — AI-powered study companion">
      {/* ── Header ─────────────────────────────────────────── */}
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

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="marketing-hero" aria-labelledby="hero-title">
        <div className="marketing-hero-split">
          <div className="marketing-hero-copy">
            <span className="marketing-badge">
              <Zap size={14} /> AI-powered study companion
            </span>
            <h1 id="hero-title" className="marketing-title">
              Study smarter, <br />
              <span className="marketing-gradient">not harder.</span>
            </h1>
            <p className="marketing-subtitle">
              Capture lectures, organize notes, and use AI to turn what you
              learn into a smarter revision workflow.
            </p>
            <div className="marketing-hero-actions">
              <Link href="/app" className="marketing-cta-primary marketing-cta-lg">
                Launch App — It&apos;s Free <ArrowRight size={18} />
              </Link>
              <Link href="/sign-up" className="marketing-cta-secondary marketing-cta-lg">
                Create Account
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

          {/* Product preview — illustrative mockup of the real app UI.
              No metrics or user activity are claimed; shapes only. */}
          <div
            className="marketing-preview"
            role="img"
            aria-label="Preview of the StudySnap app: dashboard with study goal, recent notes, and AI study tools"
          >
            <div className="marketing-browser" aria-hidden="true">
              <div className="marketing-browser-bar">
                <span className="marketing-dot" />
                <span className="marketing-dot" />
                <span className="marketing-dot" />
                <span className="marketing-url">app · dashboard</span>
              </div>
              <div className="marketing-browser-body">
                <div className="marketing-mock-side">
                  <span className="marketing-mock-logo" />
                  <span className="marketing-mock-nav marketing-mock-nav-active" />
                  <span className="marketing-mock-nav" />
                  <span className="marketing-mock-nav" />
                  <span className="marketing-mock-nav" />
                  <span className="marketing-mock-nav" />
                </div>
                <div className="marketing-mock-main">
                  <div className="marketing-mock-row">
                    <span className="marketing-mock-greet" />
                    <span className="marketing-mock-streak" />
                  </div>
                  <div className="marketing-mock-cards">
                    <div className="marketing-mock-goal">
                      <span className="marketing-mock-ring" />
                      <span className="marketing-mock-line marketing-mock-line-w60" />
                      <span className="marketing-mock-line marketing-mock-line-w40" />
                    </div>
                    <div className="marketing-mock-note">
                      <span className="marketing-mock-line marketing-mock-line-w80" />
                      <span className="marketing-mock-line marketing-mock-line-w60" />
                      <span className="marketing-mock-chips">
                        <span className="marketing-mock-chip" />
                        <span className="marketing-mock-chip" />
                      </span>
                    </div>
                  </div>
                  <span className="marketing-mock-line marketing-mock-line-w40" />
                  <div className="marketing-mock-tools">
                    <span className="marketing-mock-tool" />
                    <span className="marketing-mock-tool" />
                    <span className="marketing-mock-tool" />
                    <span className="marketing-mock-tool" />
                  </div>
                </div>
              </div>
            </div>
            <div className="marketing-float marketing-float-ai" aria-hidden="true">
              <Brain size={16} /> <span>AI summary ready</span>
            </div>
            <div className="marketing-float marketing-float-rev" aria-hidden="true">
              <Calendar size={16} /> <span>Review due today</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section id="features" className="marketing-features" aria-labelledby="features-heading">
        <div className="marketing-features-inner">
          <p className="marketing-kicker">Features</p>
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

      {/* ── How it works ───────────────────────────────────── */}
      <section id="how" className="marketing-how" aria-labelledby="how-heading">
        <div className="marketing-how-inner">
          <p className="marketing-kicker">How it works</p>
          <h2 id="how-heading" className="marketing-section-title">
            Three steps to better revision
          </h2>
          <ol className="marketing-steps">
            {steps.map((s) => (
              <li key={s.n} className="marketing-step">
                <span className="marketing-step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── AI section ─────────────────────────────────────── */}
      <section id="ai" className="marketing-ai" aria-labelledby="ai-heading">
        <div className="marketing-ai-inner">
          <div className="marketing-ai-copy">
            <p className="marketing-kicker">StudySnap AI</p>
            <h2 id="ai-heading" className="marketing-section-title marketing-section-title-left">
              Your personal AI learning companion
            </h2>
            <p className="marketing-section-sub">
              Ask questions about your own notes, turn long chapters into
              summaries, and generate practice material in one click —
              everything is generated from the study material you provide.
            </p>
            <ul className="marketing-ai-list">
              {aiCapabilities.map((c) => (
                <li key={c}>
                  <Check size={15} aria-hidden="true" /> <span>{c}</span>
                </li>
              ))}
            </ul>
            <p className="marketing-note">
              AI features run on your own notes and uploads, and need an
              internet connection to reach the AI service.
            </p>
            <Link href="/app" className="marketing-cta-primary marketing-cta-lg">
              Start with AI <ArrowRight size={18} />
            </Link>
          </div>
          <div className="marketing-ai-visual" aria-hidden="true">
            <div className="marketing-chat">
              <div className="marketing-bubble marketing-bubble-user">
                Explain photosynthesis simply
              </div>
              <div className="marketing-bubble marketing-bubble-ai">
                <span className="marketing-bubble-line marketing-bubble-line-w90" />
                <span className="marketing-bubble-line marketing-bubble-line-w70" />
                <span className="marketing-bubble-line marketing-bubble-line-w80" />
              </div>
              <div className="marketing-chat-chips">
                <span>Summarize</span>
                <span>MCQs</span>
                <span>Flashcards</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Offline philosophy ─────────────────────────────── */}
      <section className="marketing-offline" aria-labelledby="offline-heading">
        <div className="marketing-offline-inner">
          <Wifi size={28} aria-hidden="true" />
          <h2 id="offline-heading">Study when you need it.</h2>
          <p>
            Keep working even when your connection isn&apos;t perfect —
            StudySnap is an offline-first app, so your notes stay available
            and sync when you&apos;re back online.
          </p>
        </div>
      </section>

      {/* ── Privacy ────────────────────────────────────────── */}
      <section id="privacy-teaser" className="marketing-trust" aria-labelledby="trust-heading">
        <div className="marketing-trust-inner">
          <Shield size={28} aria-hidden="true" />
          <h2 id="trust-heading">Built for privacy, designed for students</h2>
          <p>
            Secure sign-in, your notes synced to your own account over an
            encrypted connection, and PIN lock for sensitive pages. Your
            study data stays yours.
          </p>
          <Link href="/privacy" className="marketing-cta-secondary">
            Read our Privacy Policy
          </Link>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section className="marketing-final" aria-labelledby="final-heading">
        <div className="marketing-final-inner">
          <h2 id="final-heading">Ready to study smarter?</h2>
          <div className="marketing-hero-actions">
            <Link href="/app" className="marketing-cta-primary marketing-cta-lg">
              Launch StudySnap <ArrowRight size={18} />
            </Link>
            <Link href="/sign-up" className="marketing-cta-secondary marketing-cta-lg">
              Create your free account
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="marketing-footer">
        <div className="marketing-footer-grid">
          <div className="marketing-footer-brand">
            <Link href="/" className="marketing-brand" aria-label="StudySnap home">
              <Image src="/window.svg" alt="" width={28} height={28} />
              <span>StudySnap</span>
            </Link>
            <p>Your AI-powered study companion. Built by {AUTHOR_NAME}, {AUTHOR_JOB}.</p>
          </div>
          <nav aria-label="Product">
            <p className="marketing-footer-head">Product</p>
            <Link href="/#features">Features</Link>
            <Link href="/#ai">StudySnap AI</Link>
            <Link href="/#how">How it works</Link>
            <Link href="/app">Launch app</Link>
          </nav>
          <nav aria-label="Account">
            <p className="marketing-footer-head">Account</p>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/sign-up">Sign up</Link>
          </nav>
          <nav aria-label="Legal">
            <p className="marketing-footer-head">Legal</p>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="/sitemap.xml">Sitemap</a>
            <a href="/llms.txt">llms.txt</a>
          </nav>
        </div>
        <div className="marketing-footer-base">
          <p>© {new Date().getFullYear()} StudySnap. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
