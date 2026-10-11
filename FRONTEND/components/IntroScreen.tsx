'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FileText, Sparkles, Calendar } from 'lucide-react';
import '../app/intro.css';

const FEATURE_CHIPS = [
  { label: 'Smart Notes', icon: FileText, className: 'intro-chip--notes' },
  { label: 'AI Study Assistant', icon: Sparkles, className: 'intro-chip--ai' },
  { label: 'Revision Planner', icon: Calendar, className: 'intro-chip--planner' },
] as const;

export default function IntroScreen() {
  const router = useRouter();
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    // 1. Prefetch /app chunks during the intro screen
    try {
      router.prefetch('/app');
    } catch {
      // Ignore prefetch errors in offline environments
    }

    // 2. Automatically navigate to /app after ~3 seconds (3000ms)
    const timer = setTimeout(() => {
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        router.replace('/app');
      }
    }, 3000);

    // 3. Clean up timer on unmount
    return () => {
      clearTimeout(timer);
    };
  }, [router]);

  const handleQuickEnter = () => {
    if (!hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      router.replace('/app');
    }
  };

  return (
    <main
      className="intro-root"
      aria-label="StudySnap Introduction"
      onClick={handleQuickEnter}
    >
      {/* Cyber mesh grid background overlay */}
      <div className="intro-grid-overlay" aria-hidden="true" />

      {/* Cinematic luminous aurora ambient lights */}
      <div className="intro-glow-bg" aria-hidden="true">
        <div className="intro-glow-blob-cyan" />
        <div className="intro-glow-blob-violet" />
      </div>

      {/* Floating Dark Glass Card */}
      <div className="intro-card">
        {/* Brand Header */}
        <div className="intro-brand">
          <div className="intro-logo-wrap">
            <Image
              src="/studysnap-logo.svg"
              alt="StudySnap Logo"
              width={42}
              height={42}
              priority
              className="intro-logo-img"
            />
          </div>
          <span className="intro-brand-name">
            Study<span className="brand-accent">Snap</span>
          </span>
        </div>

        {/* Main Heading */}
        <h1 className="intro-heading">
          Study smarter, <br />
          <span className="intro-heading-accent">not harder.</span>
        </h1>

        {/* Short Description */}
        <p className="intro-description">
          Organize your notes, learn with AI, and stay on track with your revision.
        </p>

        {/* 3 Small Feature Labels */}
        <div className="intro-chips-container" role="list" aria-label="Key features">
          {FEATURE_CHIPS.map((chip) => {
            const Icon = chip.icon;
            return (
              <span
                key={chip.label}
                className={`intro-chip ${chip.className}`}
                role="listitem"
              >
                <Icon size={14} className="intro-chip-icon" aria-hidden="true" />
                <span>{chip.label}</span>
              </span>
            );
          })}
        </div>

        {/* Glowing Progress Bar & Status Text */}
        <div className="intro-progress-section" aria-live="polite">
          <div
            className="intro-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Preparing your study space"
          >
            <div className="intro-progress-fill" />
          </div>
          <span className="intro-status-text">
            <span className="intro-pulse-dot" aria-hidden="true" />
            Preparing your study space...
          </span>
        </div>
      </div>
    </main>
  );
}
