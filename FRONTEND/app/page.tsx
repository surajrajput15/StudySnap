import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import AutoEnter from "@/components/landing/AutoEnter";
import InteractiveDemo from "@/components/landing/InteractiveDemo";
import "./marketing.css";
import { AUTHOR_NAME, AUTHOR_JOB, SITE_URL } from "@/lib/marketing/constants";

export const metadata: Metadata = {
  title: "StudySnap — Intelligent AI Study Companion & Spaced Repetition",
  description:
    "Transform lectures, notes, and PDFs into instant AI flashcards, quizzes, and spaced repetition schedules. Built offline-first for serious students.",
  alternates: { canonical: SITE_URL },
};

// Inline SVG icons — lightweight, fast, zero bundle penalty
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
const Brain = make(
  <>
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </>,
);
const Shield = make(
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
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
const Sparkles = make(
  <>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </>,
);

const benefits = [
  "100% Free for Students",
  "Secure Clerk Auth",
  "Zero-Lag Offline PWA",
  "Groq AI LLaMA-3",
  "No Credit Card Required",
];

const features = [
  {
    Icon: FileText,
    title: "Smart Markdown Notes",
    desc: "Rich-text notes with LaTeX math, code snippets, tags, folders, and client-side PIN encryption for private study notes.",
    tag: "Rich Media & Math",
    previewText: "E = mc² • \\int_0^\\infty e^{-x} dx = 1",
  },
  {
    Icon: Mic,
    title: "Voice-to-Text Lectures",
    desc: "Record live professor lectures directly into StudySnap. Get instant searchable transcripts with timestamped bookmarks.",
    tag: "98% Whisper Accuracy",
    previewText: "🎙️ Lecture_Bio101.m4a • 42:15 transcribed",
  },
  {
    Icon: Brain,
    title: "Personal AI Study Tutor",
    desc: "Generate concise summaries, key definitions, active-recall quizzes, and concept explanations in under 1 second.",
    tag: "Groq LLaMA-3 Engine",
    previewText: "⚡ Summary ready: 3 Core Insights, 12 Cards",
  },
  {
    Icon: Calendar,
    title: "Spaced Repetition (SM-2)",
    desc: "Review flashcards at scientifically optimized intervals (1d, 3d, 7d, 14d) so you study less and remember permanently.",
    tag: "SuperMemo Algorithm",
    previewText: "📅 Next Review: Due in 2h • 94% Retention",
  },
  {
    Icon: Trophy,
    title: "Streaks & Gamification",
    desc: "Stay consistent with daily study targets, XP leveling, achievement badges, and streak multipliers that keep you motivated.",
    tag: "Habit Engine",
    previewText: "🔥 12-Day Streak Active • Level 8 Scholar",
  },
  {
    Icon: Wifi,
    title: "Offline-First Resilience",
    desc: "Never lose a thought. A progressive web app (PWA) with local IndexedDB that works without internet and syncs automatically.",
    tag: "Local IndexedDB Sync",
    previewText: "● Offline Mode Active • Zero data loss",
  },
];

const steps = [
  {
    n: "01",
    tag: "CAPTURE",
    title: "Drop or Record Notes",
    desc: "Create markdown notes, import slide PDFs, or record lectures with real-time audio transcription.",
  },
  {
    n: "02",
    tag: "SYNTHESIZE",
    title: "AI Turns Notes into Assets",
    desc: "In one click, StudySnap AI extracts key terms, builds active-recall flashcard decks, and crafts practice quizzes.",
  },
  {
    n: "03",
    tag: "MASTER",
    title: "Retain With Spaced Repetition",
    desc: "The automated SM-2 scheduler prompts you right before you forget, cutting exam study time by over 50%.",
  },
];

export default function MarketingLanding() {
  return (
    <main className="marketing-root" aria-label="StudySnap — AI-powered study companion">
      {/* ── Background Aurora Lights ────────────────────────── */}
      <div className="marketing-aurora" aria-hidden="true">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="marketing-nav">
        <div className="marketing-nav-inner">
          <Link href="/" className="marketing-brand" aria-label="StudySnap home">
            <div className="brand-logo-badge">
              <Image src="/window.svg" alt="" width={24} height={24} priority />
            </div>
            <span className="brand-title">
              Study<span className="brand-accent">Snap</span>
            </span>
          </Link>

          <nav className="marketing-nav-links" aria-label="Main Navigation">
            <a href="#features" className="nav-anchor">Features</a>
            <a href="#demo" className="nav-anchor">AI Studio</a>
            <a href="#how" className="nav-anchor">How It Works</a>
            <a href="#privacy-teaser" className="nav-anchor">Privacy</a>
          </nav>

          <div className="marketing-nav-actions">
            <Link href="/sign-in" className="marketing-link">Sign in</Link>
            <Link href="/app" className="marketing-cta-primary nav-glow-btn">
              <span>Launch App</span> <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="marketing-hero" aria-labelledby="hero-title">
        <div className="marketing-hero-split">
          <div className="marketing-hero-copy">
            <div className="marketing-badge-container">
              <span className="marketing-badge shimmer">
                <Sparkles size={14} className="badge-sparkle-icon" /> Next-Gen AI Study Companion • v2.0
              </span>
            </div>

            <h1 id="hero-title" className="marketing-title">
              Study smarter, <br />
              <span className="marketing-gradient">not harder.</span>
            </h1>

            <p className="marketing-subtitle">
              Transform lectures, class notes, and PDFs into instant AI flashcards,
              active-recall quizzes, and scientifically scheduled spaced repetition.
              Built completely offline-first.
            </p>

            <div className="marketing-hero-actions">
              <Link href="/app" className="marketing-cta-primary marketing-cta-lg hero-glow-btn">
                <span>Launch StudySnap — It&apos;s Free</span> <ArrowRight size={18} />
              </Link>
              <a href="#demo" className="marketing-cta-secondary marketing-cta-lg">
                <span>Explore Live AI Demo</span>
              </a>
            </div>

            <ul className="marketing-benefits">
              {benefits.map((b) => (
                <li key={b}>
                  <Check size={16} aria-hidden="true" /> <span>{b}</span>
                </li>
              ))}
            </ul>

            {/* Controlled app entry pill (unobtrusive 4s countdown) */}
            <AutoEnter />
          </div>

          {/* ── High-Fidelity Realistic Product Preview ───────── */}
          <div
            className="marketing-preview"
            role="img"
            aria-label="High-fidelity preview of StudySnap app: active biology study note with AI tools and study goal widget"
          >
            <div className="marketing-browser-glow" aria-hidden="true" />

            <div className="marketing-browser" aria-hidden="true">
              {/* Browser Window Header */}
              <div className="marketing-browser-bar">
                <div className="marketing-window-controls">
                  <span className="marketing-dot dot-red" />
                  <span className="marketing-dot dot-yellow" />
                  <span className="marketing-dot dot-green" />
                </div>
                <div className="marketing-browser-address">
                  <span className="address-lock">🔒</span>
                  <span className="address-domain">studysnap.app</span>
                  <span className="address-path">/workspace/neurobiology-301</span>
                </div>
                <div className="marketing-browser-status">
                  <span className="status-ping" />
                  <span>Offline Ready</span>
                </div>
              </div>

              {/* Realistic App Interior */}
              <div className="marketing-browser-body">
                {/* Left Mini Sidebar */}
                <div className="marketing-mock-side">
                  <div className="mock-side-brand">
                    <span className="side-logo-icon">⚡</span>
                    <span className="side-logo-text">StudySnap</span>
                  </div>
                  <nav className="mock-side-nav">
                    <div className="mock-nav-item active">
                      <span>📚 All Notes</span>
                      <span className="mock-nav-count">24</span>
                    </div>
                    <div className="mock-nav-item">
                      <span>🎙️ Voice Memos</span>
                      <span className="mock-nav-count">8</span>
                    </div>
                    <div className="mock-nav-item">
                      <span>📅 Due Reviews</span>
                      <span className="mock-nav-pill">3</span>
                    </div>
                    <div className="mock-nav-item">
                      <span>✨ AI Tutor</span>
                    </div>
                    <div className="mock-nav-item">
                      <span>🏆 Streaks</span>
                    </div>
                  </nav>
                  <div className="mock-side-user">
                    <span className="user-avatar">🎓</span>
                    <div className="user-details">
                      <span className="user-name">Alex Kumar</span>
                      <span className="user-streak">🔥 12-Day Streak</span>
                    </div>
                  </div>
                </div>

                {/* Main Content Workspace */}
                <div className="marketing-mock-main">
                  {/* Top Bar with Goal Ring */}
                  <div className="mock-main-header">
                    <div>
                      <h4 className="mock-header-greeting">Good morning, Alex 👋</h4>
                      <p className="mock-header-sub">3 revision cards scheduled for today.</p>
                    </div>
                    {/* SVG Goal Ring */}
                    <div className="mock-goal-widget">
                      <div className="mock-goal-ring">
                        <svg viewBox="0 0 36 36" className="goal-svg">
                          <path
                            className="circle-bg"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="circle-progress"
                            strokeDasharray="75, 100"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <span className="goal-text">75%</span>
                      </div>
                      <div className="mock-goal-info">
                        <span className="goal-label">Daily Study Target</span>
                        <span className="goal-val">45 / 60 Mins</span>
                      </div>
                    </div>
                  </div>

                  {/* Active Study Note Card */}
                  <div className="mock-active-note">
                    <div className="mock-note-top">
                      <div className="mock-note-title-wrap">
                        <span className="mock-subject-pill">🧬 Neurobiology</span>
                        <span className="mock-exam-tag">Finals in 3 Days</span>
                      </div>
                      <span className="mock-note-time">Edited 12m ago</span>
                    </div>
                    <h5 className="mock-note-heading">Synaptic Plasticity & Long-Term Potentiation (LTP)</h5>
                    <p className="mock-note-text">
                      High-frequency stimulation releases glutamate, which binds to AMPA receptors and depolarizes
                      the post-synaptic membrane. This relieves the Mg²⁺ block on NMDA receptors, triggering Ca²⁺ influx...
                    </p>
                    {/* Quick AI Action Pills */}
                    <div className="mock-note-actions">
                      <span className="mock-tool-pill active">
                        <span>✨ AI Summary (1-Click)</span>
                      </span>
                      <span className="mock-tool-pill">
                        <span>🃏 15 Flashcards</span>
                      </span>
                      <span className="mock-tool-pill">
                        <span>🎯 5 Practice MCQs</span>
                      </span>
                      <span className="mock-tool-pill">
                        <span>🎙️ Listen Audio Memo</span>
                      </span>
                    </div>
                  </div>

                  {/* AI Output Result Box */}
                  <div className="mock-ai-output">
                    <div className="mock-ai-header">
                      <span className="mock-ai-icon">💡</span>
                      <span className="mock-ai-title">StudySnap AI Key Takeaways</span>
                      <span className="mock-ai-badge">Instant Synthesis</span>
                    </div>
                    <div className="mock-ai-bullets">
                      <div className="mock-bullet">
                        <span className="bullet-check">✓</span>
                        <span>AMPA receptor phosphorylation increases ion conductance and synaptic strength.</span>
                      </div>
                      <div className="mock-bullet">
                        <span className="bullet-check">✓</span>
                        <span>Structural plasticity: dendritic spine enlargement within 2 hours of LTP induction.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Glassmorphic Badges */}
            <div className="marketing-float marketing-float-ai" aria-hidden="true">
              <span className="float-badge-icon">✨</span>
              <div>
                <span className="float-badge-title">AI Summary Ready</span>
                <span className="float-badge-sub">Generated in 0.6s</span>
              </div>
            </div>

            <div className="marketing-float marketing-float-streak" aria-hidden="true">
              <span className="float-badge-icon">🔥</span>
              <div>
                <span className="float-badge-title">12-Day Streak Active!</span>
                <span className="float-badge-sub">+250 XP earned today</span>
              </div>
            </div>

            <div className="marketing-float marketing-float-rev" aria-hidden="true">
              <span className="float-badge-icon">📅</span>
              <div>
                <span className="float-badge-title">3 Reviews Due Today</span>
                <span className="float-badge-sub">Spaced Repetition active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Metric Trust Strip ─────────────────────────────── */}
      <section className="marketing-stats-strip" aria-label="StudySnap Key Metrics">
        <div className="marketing-stats-inner">
          <div className="marketing-stat-item">
            <span className="marketing-stat-val">&lt; 800ms</span>
            <span className="marketing-stat-lbl">Ultra-Fast Groq AI Synthesis</span>
          </div>
          <div className="marketing-stat-divider" aria-hidden="true" />
          <div className="marketing-stat-item">
            <span className="marketing-stat-val">8 AI Tools</span>
            <span className="marketing-stat-lbl">Summaries, MCQs, Cards & Memos</span>
          </div>
          <div className="marketing-stat-divider" aria-hidden="true" />
          <div className="marketing-stat-item">
            <span className="marketing-stat-val">100% Offline</span>
            <span className="marketing-stat-lbl">IndexedDB Local Data Persistence</span>
          </div>
          <div className="marketing-stat-divider" aria-hidden="true" />
          <div className="marketing-stat-item">
            <span className="marketing-stat-val">0$ Free</span>
            <span className="marketing-stat-lbl">No Paywalls, Made For Students</span>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section id="features" className="marketing-features" data-reveal aria-labelledby="features-heading">
        <div className="marketing-features-inner">
          <div className="section-header-centered">
            <p className="marketing-kicker">Core Features</p>
            <h2 id="features-heading" className="marketing-section-title">
              Everything you need to master your syllabus
            </h2>
            <p className="section-subtext">
              StudySnap unites note-taking, lecture recording, AI synthesis, and retention psychology into one unified study ecosystem.
            </p>
          </div>

          <div className="marketing-feature-grid">
            {features.map((f) => {
              const Icon = f.Icon;
              return (
                <article key={f.title} className="marketing-feature-card">
                  <div className="feature-card-header">
                    <div className="marketing-feature-icon">
                      <Icon size={24} aria-hidden="true" />
                    </div>
                    <span className="feature-tag">{f.tag}</span>
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <div className="feature-mini-preview">
                    <span className="mini-preview-code">{f.previewText}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Interactive Demo Showcase ──────────────────────── */}
      <section id="demo" className="marketing-demo-section" data-reveal aria-labelledby="demo-heading">
        <div className="marketing-demo-inner">
          <div className="section-header-centered">
            <p className="marketing-kicker">Interactive Showcase</p>
            <h2 id="demo-heading" className="marketing-section-title">
              Experience the StudySnap AI Studio
            </h2>
            <p className="section-subtext">
              Click the tabs below to test live AI lecture summaries, smart flashcard flips, active-recall quizzes, and audio transcription.
            </p>
          </div>

          {/* Interactive Client Component */}
          <InteractiveDemo />
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section id="how" className="marketing-how" data-reveal aria-labelledby="how-heading">
        <div className="marketing-how-inner">
          <div className="section-header-centered">
            <p className="marketing-kicker">The Learning Workflow</p>
            <h2 id="how-heading" className="marketing-section-title">
              Three steps to guaranteed retention
            </h2>
            <p className="section-subtext">
              Built on cognitive science and active recall principles proven to double long-term memory recall.
            </p>
          </div>

          <ol className="marketing-steps">
            {steps.map((s) => (
              <li key={s.n} className="marketing-step">
                <div className="step-header">
                  <span className="marketing-step-n">{s.n}</span>
                  <span className="step-tag">{s.tag}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Offline Philosophy ─────────────────────────────── */}
      <section className="marketing-offline" data-reveal aria-labelledby="offline-heading">
        <div className="marketing-offline-inner">
          <div className="offline-icon-circle">
            <Wifi size={32} aria-hidden="true" />
          </div>
          <h2 id="offline-heading">Study anywhere. Even at 30,000 feet.</h2>
          <p>
            Don&apos;t let dead zones or college Wi-Fi outages ruin your exam cram session.
            StudySnap is engineered as an offline-first Progressive Web App (PWA).
            Your notes, flashcards, and study progress live directly in your browser&apos;s local IndexedDB
            and sync smoothly with the cloud the second you reconnect.
          </p>
          <div className="offline-stats-row">
            <div className="offline-stat">
              <span className="stat-num">0ms</span>
              <span className="stat-desc">Local read latency</span>
            </div>
            <div className="offline-stat">
              <span className="stat-num">100%</span>
              <span className="stat-desc">Functional without internet</span>
            </div>
            <div className="offline-stat">
              <span className="stat-num">Auto</span>
              <span className="stat-desc">Background cloud sync</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Privacy & Trust ─────────────────────────────────── */}
      <section id="privacy-teaser" className="marketing-trust" data-reveal aria-labelledby="trust-heading">
        <div className="marketing-trust-inner">
          <div className="trust-icon-circle">
            <Shield size={32} aria-hidden="true" />
          </div>
          <h2 id="trust-heading">Built for privacy. Designed for students.</h2>
          <p>
            We believe your thoughts, lecture recordings, and exam preparation belong to you alone.
            StudySnap uses enterprise Clerk authentication, encrypted TLS transfers,
            and optional PIN locks for sensitive revision subjects.
          </p>
          <div className="trust-actions">
            <Link href="/privacy" className="marketing-cta-secondary">
              Read our Privacy Policy →
            </Link>
            <Link href="/terms" className="marketing-link">
              Terms of Service
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final High-Impact CTA ──────────────────────────── */}
      <section className="marketing-final" data-reveal aria-labelledby="final-heading">
        <div className="marketing-final-inner">
          <span className="marketing-final-badge">⚡ Start Learning Better Today</span>
          <h2 id="final-heading">Ready to ace your next exam?</h2>
          <p className="final-subtext">
            Join students studying smarter with AI-driven summaries, spaced repetition, and voice notes.
          </p>
          <div className="marketing-hero-actions">
            <Link href="/app" className="marketing-cta-primary marketing-cta-lg final-glow-btn">
              <span>Launch StudySnap — It&apos;s Free</span> <ArrowRight size={18} />
            </Link>
            <Link href="/sign-up" className="marketing-cta-secondary marketing-cta-lg">
              <span>Create Account</span>
            </Link>
          </div>
          <p className="final-guarantee">No credit card required • Instant access in 5 seconds</p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="marketing-footer">
        <div className="marketing-footer-grid">
          <div className="marketing-footer-brand">
            <Link href="/" className="marketing-brand" aria-label="StudySnap home">
              <div className="brand-logo-badge">
                <Image src="/window.svg" alt="" width={24} height={24} />
              </div>
              <span className="brand-title">
                Study<span className="brand-accent">Snap</span>
              </span>
            </Link>
            <p>
              Your intelligent AI-powered study companion.
              Built by {AUTHOR_NAME}, {AUTHOR_JOB}.
            </p>
          </div>
          <nav aria-label="Product Links">
            <p className="marketing-footer-head">Product</p>
            <a href="#features">Features</a>
            <a href="#demo">AI Studio</a>
            <a href="#how">How It Works</a>
            <Link href="/app">Launch App</Link>
          </nav>
          <nav aria-label="Account Links">
            <p className="marketing-footer-head">Account</p>
            <Link href="/sign-in">Sign In</Link>
            <Link href="/sign-up">Create Free Account</Link>
          </nav>
          <nav aria-label="Legal Links">
            <p className="marketing-footer-head">Legal & Sitemap</p>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <a href="/sitemap.xml">Sitemap.xml</a>
          </nav>
        </div>
        <div className="marketing-footer-base">
          <p>© {new Date().getFullYear()} StudySnap. All rights reserved. Built with Next.js, Groq AI & Clerk.</p>
        </div>
      </footer>
    </main>
  );
}
