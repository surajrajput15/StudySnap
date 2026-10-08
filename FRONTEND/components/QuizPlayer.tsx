'use client';

import React, { useState } from 'react';
import { celebrate } from '@/lib/confetti';
import { HelpCircle, CheckCircle, XCircle, ArrowLeft, RotateCcw, Clock, Award } from 'lucide-react';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const DEFAULT_QUIZ: QuizQuestion[] = [
  {
    question: 'Which of the following describes the "Ebbinghaus Forgetting Curve"?',
    options: [
      'Memory retention drops sharply shortly after learning unless reviewed',
      'Memory improves automatically over time without effort',
      'Auditory learning is 10x faster than reading',
      'Sleep has no effect on long-term cognitive recall',
    ],
    correctAnswer: 0,
    explanation: 'Hermann Ebbinghaus demonstrated that humans forget roughly 50% of newly learned information within one hour without deliberate review.',
  },
  {
    question: 'What is the optimal study duration in the classic Pomodoro Technique?',
    options: ['45 minutes', '25 minutes', '60 minutes', '15 minutes'],
    correctAnswer: 1,
    explanation: 'The standard Pomodoro interval consists of 25 minutes of unbroken focus followed by a 5-minute break.',
  },
  {
    question: 'Which learning methodology actively tests understanding by teaching another person in simple terms?',
    options: ['Cornell System', 'Feynman Technique', 'Leitner Box System', 'Mind Mapping'],
    correctAnswer: 1,
    explanation: 'The Feynman Technique relies on explaining complex concepts in simple, jargon-free language to expose knowledge gaps.',
  },
  {
    question: 'Why is spaced repetition more effective than "cramming"?',
    options: [
      'It requires zero attention',
      'It triggers synaptic consolidation at expanding time intervals',
      'It uses less brain energy',
      'It only works for mathematics',
    ],
    correctAnswer: 1,
    explanation: 'Spaced repetition prompts the brain to reconstruct neural connections right before they fade, strengthening long-term memory traces.',
  },
];

interface QuizPlayerProps {
  onBack?: () => void;
  questions?: QuizQuestion[];
  topicTitle?: string;
}

export default function QuizPlayer({ onBack, questions: initialQuestions, topicTitle }: QuizPlayerProps) {
  const questions = initialQuestions && initialQuestions.length > 0 ? initialQuestions : DEFAULT_QUIZ;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Array<{ selected: number; correct: boolean }>>([]);
  const [isFinished, setIsFinished] = useState(false);

  const currentQ = questions[currentIndex];

  const handleSelectOption = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);

    const isCorrect = index === currentQ.correctAnswer;
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }

    setUserAnswers((prev) => [...prev, { selected: index, correct: isCorrect }]);
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
      celebrate({ particleCount: 70, colors: ['#0061A4', '#10B981', '#F59E0B'] });
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setUserAnswers([]);
    setIsFinished(false);
  };

  const percentage = Math.round((score / questions.length) * 100);

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
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
              <HelpCircle size={20} color="var(--primary)" /> {topicTitle || 'Interactive Study Quiz'}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>
              Evaluate your recall & mastery
            </div>
          </div>
        </div>

        {!isFinished && (
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--secondary)' }}>
            Question {currentIndex + 1} of {questions.length}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {!isFinished && (
        <div style={{ height: '6px', background: 'var(--surface-variant)', borderRadius: '999px', overflow: 'hidden', marginBottom: '24px' }}>
          <div
            style={{
              height: '100%',
              width: `${((currentIndex + 1) / questions.length) * 100}%`,
              background: 'linear-gradient(90deg, var(--primary), var(--primary-light))',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      {!isFinished ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: 'var(--elevation-2)',
          }}
        >
          {/* Question Text */}
          <div style={{ fontSize: '1.15rem', fontWeight: 600, lineHeight: 1.5, marginBottom: '24px', color: 'var(--on-surface)' }}>
            {currentQ.question}
          </div>

          {/* Options List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQ.correctAnswer;

              let border = '1px solid var(--outline-variant)';
              let bg = 'var(--surface-variant)';
              let color = 'var(--on-surface)';

              if (isAnswered) {
                if (isCorrect) {
                  border = '2px solid #059669';
                  bg = '#ecfdf5';
                  color = '#065f46';
                } else if (isSelected && !isCorrect) {
                  border = '2px solid #dc2626';
                  bg = '#fef2f2';
                  color = '#991b1b';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={isAnswered}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '12px',
                    border,
                    background: bg,
                    color,
                    textAlign: 'left',
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: '0.9375rem',
                    cursor: isAnswered ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </div>

                  {isAnswered && (
                    <span>
                      {isCorrect ? <CheckCircle size={18} color="#059669" /> : isSelected ? <XCircle size={18} color="#dc2626" /> : null}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Explanation Banner */}
          {isAnswered && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: selectedOption === currentQ.correctAnswer ? '#ecfdf5' : '#fffbeb',
                border: `1px solid ${selectedOption === currentQ.correctAnswer ? '#a7f3d0' : '#fde68a'}`,
                marginBottom: '20px',
                fontSize: '0.875rem',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '4px', color: selectedOption === currentQ.correctAnswer ? '#065f46' : '#92400e' }}>
                {selectedOption === currentQ.correctAnswer ? '✓ Correct Answer!' : 'Explanation:'}
              </div>
              <div style={{ color: 'var(--on-surface)' }}>{currentQ.explanation}</div>
            </div>
          )}

          {/* Next Button */}
          {isAnswered && (
            <button
              onClick={handleNext}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.9375rem',
                cursor: 'pointer',
              }}
            >
              {currentIndex + 1 < questions.length ? 'Next Question →' : 'See Results 🎉'}
            </button>
          )}
        </div>
      ) : (
        /* Results Report */
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
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
            {percentage >= 75 ? '🏆' : percentage >= 50 ? '👏' : '📚'}
          </div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px 0' }}>Quiz Complete!</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--secondary)', marginBottom: '24px' }}>
            You scored {score} out of {questions.length} questions ({percentage}%).
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '28px' }}>
            <div style={{ background: '#ecfdf5', padding: '16px 24px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#065f46' }}>{score}</div>
              <div style={{ fontSize: '0.75rem', color: '#047857' }}>Correct</div>
            </div>
            <div style={{ background: '#fef2f2', padding: '16px 24px', borderRadius: '12px', border: '1px solid #fca5a5' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#991b1b' }}>{questions.length - score}</div>
              <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>Missed</div>
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
            <RotateCcw size={16} /> Retake Quiz
          </button>
        </div>
      )}
    </div>
  );
}
