'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store/useStore';
import { celebrate } from '@/lib/confetti';
import { LayoutGrid, RotateCw, CheckCircle, ThumbsUp, AlertCircle, RefreshCw, ArrowLeft, Plus } from 'lucide-react';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

const DEFAULT_DECK: Flashcard[] = [
  {
    id: '1',
    front: 'What is Active Recall?',
    back: 'The principle of stimulating memory during the learning process by actively testing yourself rather than passively reading.',
    category: 'Learning Science',
  },
  {
    id: '2',
    front: 'How does the Spaced Repetition System work?',
    back: 'It reviews information at increasing intervals over time according to the forgetting curve, maximizing long-term retention.',
    category: 'Cognitive Science',
  },
  {
    id: '3',
    front: 'What is the Feynman Technique?',
    back: 'A four-step mental model: Choose a concept, explain it in simple terms as if teaching a child, identify gaps, and review/simplify.',
    category: 'Productivity',
  },
  {
    id: '4',
    front: 'What is the Pomodoro Technique?',
    back: 'A time management method using 25-minute intervals of focused work followed by a 5-minute break.',
    category: 'Focus',
  },
];

interface FlashcardViewerProps {
  onBack?: () => void;
  cards?: Flashcard[];
}

export default function FlashcardViewer({ onBack, cards: customCards }: FlashcardViewerProps) {
  const notes = useStore((s) => s.notes);
  const [deck, setDeck] = useState<Flashcard[]>(() => {
    if (customCards && customCards.length > 0) return customCards;
    // Build from existing user notes if available
    if (notes && notes.length > 0) {
      const noteCards = notes.slice(0, 5).map((n, i) => ({
        id: `note-${n.id}`,
        front: n.title || `Concept #${i + 1}`,
        back: n.content ? n.content.slice(0, 150) + '...' : 'Review key concepts for this topic.',
        category: n.tags?.[0] || 'My Notes',
      }));
      return [...noteCards, ...DEFAULT_DECK];
    }
    return DEFAULT_DECK;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<{ easy: number; good: number; hard: number }>({
    easy: 0,
    good: 0,
    hard: 0,
  });
  const [isCompleted, setIsCompleted] = useState(false);

  const currentCard = deck[currentIndex];

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleAnswer = (rating: 'easy' | 'good' | 'hard') => {
    setResults((prev) => ({ ...prev, [rating]: prev[rating] + 1 }));
    setIsFlipped(false);

    if (currentIndex + 1 < deck.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      celebrate({ particleCount: 60, colors: ['#10B981', '#3B82F6', '#F59E0B'] });
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults({ easy: 0, good: 0, hard: 0 });
    setIsCompleted(false);
  };

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: '1px solid var(--outline-variant)',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--on-surface)',
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutGrid size={20} color="var(--primary)" /> Smart Flashcards
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>
              Spaced Repetition & Active Recall Session
            </div>
          </div>
        </div>

        {!isCompleted && (
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--secondary)' }}>
            Card {currentIndex + 1} of {deck.length}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {!isCompleted && (
        <div style={{ height: '6px', background: 'var(--surface-variant)', borderRadius: '999px', overflow: 'hidden', marginBottom: '24px' }}>
          <div
            style={{
              height: '100%',
              width: `${((currentIndex + 1) / deck.length) * 100}%`,
              background: 'linear-gradient(90deg, var(--primary), var(--primary-light))',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      {/* Card Arena */}
      {!isCompleted ? (
        <div>
          <div
            onClick={handleFlip}
            style={{
              minHeight: '260px',
              background: 'var(--surface)',
              border: '2px solid var(--outline-variant)',
              borderRadius: '20px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              boxShadow: 'var(--elevation-2)',
              transition: 'transform 0.2s ease, border-color 0.2s ease',
              position: 'relative',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--primary)',
                  letterSpacing: '0.05em',
                }}
              >
                {currentCard?.category || 'General Concept'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RotateCw size={12} /> {isFlipped ? 'Tap to see prompt' : 'Tap to reveal answer'}
              </span>
            </div>

            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  lineHeight: 1.5,
                  color: isFlipped ? 'var(--primary-dark)' : 'var(--on-surface)',
                }}
              >
                {isFlipped ? currentCard?.back : currentCard?.front}
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--secondary)' }}>
              {isFlipped ? '✨ Answer Side' : '❓ Question Side'}
            </div>
          </div>

          {/* Rating Controls (Shown after flip) */}
          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => handleAnswer('hard')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #fca5a5',
                background: '#fef2f2',
                color: '#991b1b',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <AlertCircle size={16} /> Hard (Review Soon)
            </button>

            <button
              onClick={() => handleAnswer('good')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                color: '#1e40af',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <ThumbsUp size={16} /> Good (Understood)
            </button>

            <button
              onClick={() => handleAnswer('easy')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #a7f3d0',
                background: '#ecfdf5',
                color: '#065f46',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle size={16} /> Easy (Mastered)
            </button>
          </div>
        </div>
      ) : (
        /* Completed Summary */
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '20px',
            padding: '36px',
            textAlign: 'center',
            boxShadow: 'var(--elevation-2)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎉</div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px 0' }}>Deck Completed!</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--secondary)', marginBottom: '24px' }}>
            Great job! You reviewed {deck.length} flashcards in this session.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
            <div style={{ background: '#ecfdf5', padding: '16px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#065f46' }}>{results.easy}</div>
              <div style={{ fontSize: '0.75rem', color: '#047857' }}>Easy</div>
            </div>
            <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e40af' }}>{results.good}</div>
              <div style={{ fontSize: '0.75rem', color: '#1d4ed8' }}>Good</div>
            </div>
            <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '12px', border: '1px solid #fca5a5' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#991b1b' }}>{results.hard}</div>
              <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>Hard</div>
            </div>
          </div>

          <button
            onClick={handleRestart}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              background: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.9375rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <RefreshCw size={16} /> Study Again
          </button>
        </div>
      )}
    </div>
  );
}
