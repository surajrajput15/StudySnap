import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  FileText, Mic, Calendar, Trophy, BookOpen,
  Brain, Shield, Zap, ArrowRight, Check
} from "lucide-react";
import { AUTHOR_NAME, AUTHOR_JOB, SITE_URL } from "@/lib/marketing/constants";

export const metadata: Metadata = {
  title: "StudySnap — Your AI-powered Study Companion",
  description:
    "Capture, organize, listen to, and revise study notes with built-in AI. " +
    "Voice notes, spaced repetition, AI tutor, and offline-first PWA.",
  alternates: { canonical: SITE_URL },
};

const features = [
  { icon: FileText, title: "Smart Notes", desc: "Auto-save rich-text notes with categories, folders, and PIN lock." },
  { icon: Mic, title: "Voice Notes", desc: "Record and transcribe lectures. Cloudinary-backed audio storage." },
  { icon: Brain, title: "AI Tutor", desc: "Chat, summarize, generate MCQs and flashcards with Llama 3." },
  { icon: Calendar, title: "Spaced Repetition", desc: "Schedule easy/medium/hard reviews to never forget." },
  { icon: Trophy, title: "Gamification", desc: "Streaks, achievements, and milestones to keep you on track." },
  { icon: BookOpen, title: "Offline-first", desc: "PWA with service worker — study anywhere, sync when online." },
];

const benefits = [
  "Free to use, no credit card required",
  "End-to-end encrypted sessions via Clerk",
  "Works offline, syncs across devices",
  "AI-powered learning, human-friendly UX",
];

export default function MarketingLanding() {
  return (
    <main className="marketing-root">
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

      <section className="marketing-hero">
        <div className="marketing-hero-inner">
          <span className="marketing-badge">
            <Zap size={14} /> AI-powered study companion
          </span>
          <h1 className="marketing-title">
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
              const Icon = f.icon;
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
