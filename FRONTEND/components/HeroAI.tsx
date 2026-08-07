'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Play } from 'lucide-react';

const AI_CHIPS = [
  { emoji: '📝', label: 'Summaries' },
  { emoji: '❓', label: 'MCQs' },
  { emoji: '🧠', label: 'Flashcards' },
  { emoji: '🧩', label: 'Quiz' },
  { emoji: '🗺', label: 'Mind Maps' },
  { emoji: '🌍', label: 'Translate' },
  { emoji: '💡', label: 'Explain' },
  { emoji: '📄', label: 'PDF AI' },
];

function AIIllustration() {
  return (
    <svg viewBox="0 0 320 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="hero-ai-illustration">
      {/* Brain glow */}
      <circle cx="160" cy="120" r="100" fill="url(#brainGlow)" opacity="0.25" />
      <defs>
        <radialGradient id="brainGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#80bfff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#80bfff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Brain shape */}
      <path d="M160 60c-22 0-40 14-40 32 0 8 3 16 9 22-7 5-12 13-12 22 0 16 14 29 32 29 6 0 11-1 16-3v-8c-5 2-10 3-16 3-13 0-24-9-24-21 0-7 4-13 10-17l3-2-2-3c-4-5-6-11-6-17 0-14 13-25 30-25s30 11 30 25c0 6-2 12-6 17l-2 3 3 2c6 4 10 10 10 17 0 12-11 21-24 21-6 0-11-1-16-3v8c5 2 10 3 16 3 18 0 32-13 32-29 0-9-5-17-12-22 6-6 9-14 9-22 0-18-18-32-40-32z" fill="url(#brainGrad)" opacity="0.9" />
      <defs>
        <linearGradient id="brainGrad" x1="120" y1="60" x2="200" y2="160">
          <stop offset="0%" stopColor="#80bfff" />
          <stop offset="100%" stopColor="#4da6ff" />
        </linearGradient>
      </defs>
      {/* Brain lines */}
      <path d="M145 90c0 0 8 14 15 14s15-14 15-14" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M135 108c0 0 10 12 25 12s25-12 25-12" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <path d="M140 126c0 0 8 10 20 10s20-10 20-10" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      {/* Book stack */}
      <rect x="130" y="165" width="60" height="10" rx="3" fill="var(--primary-container)" opacity="0.8" />
      <rect x="125" y="175" width="70" height="8" rx="3" fill="var(--primary-container)" opacity="0.6" />
      <rect x="135" y="183" width="50" height="8" rx="3" fill="var(--primary-container)" opacity="0.4" />
      {/* Sparkle dots */}
      <circle cx="90" cy="80" r="3" fill="#80bfff" opacity="0.6"><animate attributeName="opacity" values="0.6;0.2;0.6" dur="3s" repeatCount="indefinite" /></circle>
      <circle cx="230" cy="70" r="2.5" fill="#80bfff" opacity="0.4"><animate attributeName="opacity" values="0.4;0.1;0.4" dur="2.5s" repeatCount="indefinite" /></circle>
      <circle cx="250" cy="110" r="2" fill="#80bfff" opacity="0.5"><animate attributeName="opacity" values="0.5;0.15;0.5" dur="3.5s" repeatCount="indefinite" /></circle>
      <circle cx="75" cy="130" r="2" fill="#80bfff" opacity="0.3"><animate attributeName="opacity" values="0.3;0.1;0.3" dur="2.8s" repeatCount="indefinite" /></circle>
      {/* AI chip */}
      <rect x="138" y="195" width="44" height="18" rx="9" fill="rgba(255,255,255,0.15)" />
      <text x="160" y="207" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="Inter">AI</text>
    </svg>
  );
}

interface HeroAIProps {
  onNavigate: (tab: string) => void;
}

export default function HeroAI({ onNavigate }: HeroAIProps) {
  const scrollToTools = () => {
    const el = document.getElementById('ai-tools-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      onNavigate('ai');
    }
  };

  return (
    <motion.div
      className="hero-ai-premium"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Animated background blobs */}
      <div className="hero-ai-blobs">
        <motion.div
          className="hero-ai-blob hero-ai-blob-1"
          animate={{ x: [0, 15, 0], y: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="hero-ai-blob hero-ai-blob-2"
          animate={{ x: [0, -12, 0], y: [0, 12, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="hero-ai-blob hero-ai-blob-3"
          animate={{ x: [0, 8, 0], y: [0, -8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="hero-ai-inner">
        {/* Left: Content */}
        <div className="hero-ai-content">
          <motion.div
            className="hero-ai-badge"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <Sparkles size={14} />
            AI Study Assistant
          </motion.div>

          <motion.h2
            className="hero-ai-heading"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
          >
            Your Personal AI<br />Learning Companion
          </motion.h2>

          <motion.p
            className="hero-ai-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            Generate Summaries · MCQs · Flashcards · Mind Maps · Quizzes · Translation · PDF AI
          </motion.p>

          <motion.p
            className="hero-ai-desc"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            Ask questions, simplify difficult topics, generate revision notes, create quizzes, and study smarter with AI.
          </motion.p>

          <motion.div
            className="hero-ai-buttons"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <motion.button
              className="hero-ai-btn-primary"
              onClick={() => onNavigate('ai')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Sparkles size={16} /> Start with AI
            </motion.button>
            <motion.button
              className="hero-ai-btn-secondary"
              onClick={scrollToTools}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Play size={16} /> Explore AI Tools
            </motion.button>
          </motion.div>

          <motion.div
            className="hero-ai-chips"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, staggerChildren: 0.04 }}
          >
            {AI_CHIPS.map((chip, i) => (
              <motion.span
                key={chip.label}
                className="hero-ai-chip"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.04, duration: 0.3 }}
                whileHover={{ scale: 1.05, y: -2 }}
              >
                {chip.emoji} {chip.label}
              </motion.span>
            ))}
          </motion.div>
        </div>

        {/* Right: Illustration */}
        <motion.div
          className="hero-ai-visual"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
        >
          <AIIllustration />
        </motion.div>
      </div>
    </motion.div>
  );
}
