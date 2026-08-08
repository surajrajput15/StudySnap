'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store/useStore';
import {
  Calendar, Clock, CalendarDays, Star, Pin, Brain,
  TrendingUp, BarChart3, Target, Zap, ChevronLeft, ChevronRight,
  CheckCircle2, AlertCircle, Timer, Award
} from 'lucide-react';
import confetti from 'canvas-confetti';
import EmptyState, { EmptyRevisionIllustration } from './EmptyState';
import { MONTHS, DAYS_SHORT, DAILY_GOAL } from '@/lib/constants';
import { formatShortDate } from '@/lib/utils';

function DonutChart({ easy, medium, hard }: { easy: number; medium: number; hard: number }) {
  const total = easy + medium + hard || 1;
  const segments = [
    { value: easy / total, color: '#10B981', label: 'Easy' },
    { value: medium / total, color: '#3B82F6', label: 'Medium' },
    { value: hard / total, color: '#EF4444', label: 'Hard' },
  ];
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="revision-donut">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--outline-variant)" strokeWidth="8" />
        {segments.map((seg, i) => {
          const len = seg.value * circumference;
          const dash = `${len} ${circumference - len}`;
          const o = -offset;
          offset += len;
          return seg.value > 0 ? (
            <circle key={i} cx="50" cy="50" r={radius} fill="none" stroke={seg.color} strokeWidth="8" strokeDasharray={dash} strokeDashoffset={o} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
          ) : null;
        })}
      </svg>
      <div className="revision-donut-center">
        <div className="revision-donut-value">{total}</div>
        <div className="revision-donut-label">total</div>
      </div>
    </div>
  );
}

function MiniCalendar({ month, year, revisionDates, onPrev, onNext }: {
  month: number; year: number; revisionDates: Set<string>;
  onPrev: () => void; onNext: () => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="revision-mini-cal">
      <div className="revision-cal-header">
        <button onClick={onPrev} className="revision-cal-nav" aria-label="Previous month"><ChevronLeft size={14} /></button>
        <span className="revision-cal-month">{MONTHS[month]} {year}</span>
        <button onClick={onNext} className="revision-cal-nav" aria-label="Next month"><ChevronRight size={14} /></button>
      </div>
      <div className="revision-cal-grid">
        {DAYS_SHORT.map(d => <div key={d} className="revision-cal-day-header">{d}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e-${i}`} className="revision-cal-cell empty" />;
          const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const hasRevision = revisionDates.has(dateStr);
          return (
            <div key={dateStr} className={`revision-cal-cell ${isToday ? 'today' : ''} ${hasRevision ? 'has-revision' : ''}`}>
              <span>{d}</span>
              {hasRevision && <div className="revision-cal-dot" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RevisionCalendar() {
  const notes = useStore((s) => s.notes);
  const revisionLogs = useStore((s) => s.revisionLogs);
  const markAsRevised = useStore((s) => s.markAsRevised);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(23, 59, 59, 999);
    return t;
  }, []);

  const revisionNotes = useMemo(() =>
    notes.filter(n => n.nextRevisionAt).sort((a, b) => new Date(a.nextRevisionAt!).getTime() - new Date(b.nextRevisionAt!).getTime()),
    [notes]
  );

  const dueNotes = useMemo(() => revisionNotes.filter(n => new Date(n.nextRevisionAt!) <= today), [revisionNotes, today]);
  const upcomingNotes = useMemo(() => revisionNotes.filter(n => new Date(n.nextRevisionAt!) > today), [revisionNotes, today]);

  const easyCount = revisionLogs.filter(l => l.rating === 'easy').length;
  const mediumCount = revisionLogs.filter(l => l.rating === 'medium').length;
  const hardCount = revisionLogs.filter(l => l.rating === 'hard').length;

  const estimatedTime = dueNotes.length * 8;

  // Weekly revision data for chart
  const weeklyData = useMemo(() => {
    const data: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const count = revisionLogs.filter(l => l.revisedAt.startsWith(dayStr)).length;
      data.push({
        day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        count,
      });
    }
    return data;
  }, [revisionLogs]);

  const weeklyMax = Math.max(...weeklyData.map(d => d.count), 3);

  // Revision dates for calendar
  const revisionDates = useMemo(() => {
    const dates = new Set<string>();
    revisionLogs.forEach(l => dates.add(l.revisedAt.split('T')[0]));
    return dates;
  }, [revisionLogs]);

  // Daily goal
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRevised = revisionLogs.filter(l => l.revisedAt.startsWith(todayStr)).length;

  // AI prediction (simple heuristic based on weekly pattern)
  const aiPrediction = useMemo(() => {
    const avg = weeklyData.reduce((s, d) => s + d.count, 0) / 7;
    const predicted = Math.round(avg * 1.2);
    return Math.max(predicted, dueNotes.length);
  }, [weeklyData, dueNotes.length]);

  const handleRevise = (noteId: string, rating: 'easy' | 'medium' | 'hard') => {
    markAsRevised(noteId, rating);
    confetti({ particleCount: 50, spread: 60, colors: rating === 'easy' ? ['#10B981'] : rating === 'medium' ? ['#3B82F6'] : ['#F59E0B'] });
  };

  const handleCalPrev = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const handleCalNext = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  return (
    <div className="revision-dashboard">
      {/* Header */}
      <div className="revision-dash-header">
        <div>
          <h2 className="revision-dash-title">
            <Brain size={22} style={{ color: 'var(--primary)' }} />
            Spaced Repetition
          </h2>
          <p className="revision-dash-subtitle">
            AI-optimized revision scheduling for long-term retention
          </p>
        </div>
        <div className="revision-dash-badge">
          <Zap size={14} /> AI predicts {aiPrediction} cards today
        </div>
      </div>

      {/* Stats Row */}
      <div className="revision-stats-row">
        <div className="revision-stat-card">
          <div className="revision-stat-icon" style={{ background: 'rgba(0, 97, 164, 0.12)' }}>
            <Clock size={16} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <div className="revision-stat-value">{dueNotes.length}</div>
            <div className="revision-stat-label">Today&apos;s Cards</div>
          </div>
        </div>
        <div className="revision-stat-card">
          <div className="revision-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
            <CalendarDays size={16} style={{ color: '#10B981' }} />
          </div>
          <div>
            <div className="revision-stat-value">{upcomingNotes.length}</div>
            <div className="revision-stat-label">Upcoming</div>
          </div>
        </div>
        <div className="revision-stat-card">
          <div className="revision-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)' }}>
            <Timer size={16} style={{ color: '#F59E0B' }} />
          </div>
          <div>
            <div className="revision-stat-value">{estimatedTime}<span style={{ fontSize: '12px', fontWeight: 500, opacity: 0.6 }}>m</span></div>
            <div className="revision-stat-label">Est. Time</div>
          </div>
        </div>
        <div className="revision-stat-card">
          <div className="revision-stat-icon" style={{ background: 'rgba(236, 72, 153, 0.12)' }}>
            <Target size={16} style={{ color: '#EC4899' }} />
          </div>
          <div>
            <div className="revision-stat-value">{todayRevised}<span style={{ fontSize: '12px', fontWeight: 500, opacity: 0.6 }}>/{DAILY_GOAL}</span></div>
            <div className="revision-stat-label">Daily Goal</div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="revision-progress-section">
        <div className="revision-progress-header">
          <span>Today&apos;s Progress</span>
          <span className="revision-progress-percent">{Math.round((todayRevised / DAILY_GOAL) * 100)}%</span>
        </div>
        <div className="revision-progress-track">
          <div className="revision-progress-fill" style={{ width: `${Math.min((todayRevised / DAILY_GOAL) * 100, 100)}%` }} />
        </div>
        <div className="revision-progress-labels">
          <span>{todayRevised} revised</span>
          <span>{Math.max(DAILY_GOAL - todayRevised, 0)} remaining</span>
        </div>
      </div>

      {/* Main Grid: 2-column layout */}
      <div className="revision-main-grid">
        {/* Difficulty + Progress */}
        <div className="revision-card">
          <div className="revision-card-header">
            <BarChart3 size={16} style={{ color: 'var(--primary)' }} />
            <span>Difficulty Breakdown</span>
          </div>
          <div className="revision-difficulty-body">
            <DonutChart easy={easyCount} medium={mediumCount} hard={hardCount} />
            <div className="revision-difficulty-legend">
              <div className="revision-legend-item"><div className="revision-legend-dot" style={{ background: '#10B981' }} /> Easy <span className="revision-legend-count">{easyCount}</span></div>
              <div className="revision-legend-item"><div className="revision-legend-dot" style={{ background: '#3B82F6' }} /> Medium <span className="revision-legend-count">{mediumCount}</span></div>
              <div className="revision-legend-item"><div className="revision-legend-dot" style={{ background: '#EF4444' }} /> Hard <span className="revision-legend-count">{hardCount}</span></div>
            </div>
          </div>
        </div>

        {/* Mini Calendar */}
        <div className="revision-card">
          <div className="revision-card-header">
            <Calendar size={16} style={{ color: 'var(--primary)' }} />
            <span>Activity Calendar</span>
          </div>
          <MiniCalendar month={calMonth} year={calYear} revisionDates={revisionDates} onPrev={handleCalPrev} onNext={handleCalNext} />
          <div className="revision-cal-legend">
            <div className="revision-cal-legend-item"><div className="revision-cal-legend-dot" /> Revised</div>
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="revision-card revision-card-wide">
          <div className="revision-card-header">
            <TrendingUp size={16} style={{ color: 'var(--primary)' }} />
            <span>Weekly Revision Trend</span>
          </div>
          <div className="revision-weekly-chart">
            {weeklyData.map((d) => (
              <div key={d.day} className="revision-weekly-bar-col">
                <div className="revision-weekly-bar-wrapper">
                  <div className="revision-weekly-bar" style={{
                    height: `${(d.count / weeklyMax) * 100}%`,
                    background: d.count > 0 ? 'linear-gradient(180deg, var(--primary-light), var(--primary))' : 'var(--outline-variant)',
                    opacity: d.count > 0 ? 1 : 0.2,
                  }} />
                </div>
                <span className="revision-weekly-label">{d.day}</span>
                <span className="revision-weekly-value">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Goal Card */}
        <div className="revision-card">
          <div className="revision-card-header">
            <Award size={16} style={{ color: 'var(--primary)' }} />
            <span>Daily Goal</span>
          </div>
          <div className="revision-goal-body">
            <div className="revision-goal-ring">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="var(--outline-variant)" strokeWidth="6" />
                <circle cx="40" cy="40" r="32" fill="none" stroke="var(--primary)" strokeWidth="6" strokeDasharray={`${(todayRevised / DAILY_GOAL) * 201} 201`} strokeLinecap="round" transform="rotate(-90 40 40)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
              </svg>
              <div className="revision-goal-ring-center">
                <span className="revision-goal-value">{todayRevised}</span>
                <span className="revision-goal-divider">/{DAILY_GOAL}</span>
              </div>
            </div>
            <div className="revision-goal-info">
              <div className="revision-goal-text">{todayRevised >= DAILY_GOAL ? 'Goal Complete! 🎉' : `${DAILY_GOAL - todayRevised} more to reach goal`}</div>
              <div className="revision-goal-streak">
                <Star size={12} fill="#F59E0B" color="#F59E0B" />
                Consistency builds mastery
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Due Cards Section */}
      <div className="revision-section">
        <div className="revision-section-header">
          <h3 className="revision-section-title">
            <Clock size={18} style={{ color: 'var(--primary)' }} />
            Today&apos;s Cards
            {dueNotes.length > 0 && <span className="revision-section-badge">{dueNotes.length} due</span>}
          </h3>
        </div>
        {dueNotes.length === 0 ? (
          <EmptyState
            illustration={<EmptyRevisionIllustration />}
            title="No Cards Due"
            message="You're ahead of schedule! All notes have been revised within their intervals."
            tip="Mark notes for revision to build a consistent study habit."
          />
        ) : (
          <div className="revision-cards-list">
            {dueNotes.map((note) => {
              return (
                <div key={note.id} className="revision-card-item">
                  <div className="revision-card-item-left">
                    <div className="revision-card-item-title">{note.title}</div>
                    <div className="revision-card-item-meta">
                      <span>Last: {note.lastRevisedAt ? formatShortDate(note.lastRevisedAt) : 'Never'}</span>
                      <span className="revision-meta-streak">Streak {note.revisionStreak}x</span>
                      {note.isPinned && <Pin size={10} style={{ color: 'var(--primary)' }} />}
                      {note.isFavorite && <Star size={10} style={{ color: '#F59E0B' }} />}
                    </div>
                  </div>
                  <div className="revision-card-item-actions">
                    {(['hard', 'medium', 'easy'] as const).map((r) => (
                      <button key={r} onClick={() => handleRevise(note.id, r)}
                        className="revision-rating-btn"
                        style={{
                          background: r === 'hard' ? '#EF4444' : r === 'medium' ? '#3B82F6' : '#10B981',
                        }}>
                        {r === 'hard' ? 'Hard' : r === 'medium' ? 'Medium' : 'Easy'}
                        <span className="revision-rating-days">{r === 'hard' ? '1d' : r === 'medium' ? '3d' : '7d'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming + History Row */}
      <div className="revision-bottom-grid">
        {/* Upcoming */}
        <div className="revision-section">
          <h3 className="revision-section-title" style={{ marginBottom: '12px' }}>
            <CalendarDays size={18} style={{ color: 'var(--primary)' }} />
            Upcoming ({upcomingNotes.length})
          </h3>
          {upcomingNotes.length === 0 ? (
            <div className="revision-info-box">
              <CalendarDays size={16} />
              No upcoming schedules. Start revising to build your schedule.
            </div>
          ) : (
            <div className="revision-upcoming-list">
              {upcomingNotes.map((note) => (
                <div key={note.id} className="revision-upcoming-item">
                  <span className="revision-upcoming-title">{note.title}</span>
                  <span className="revision-upcoming-date">
                    {formatShortDate(note.nextRevisionAt!)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div className="revision-section">
          <h3 className="revision-section-title" style={{ marginBottom: '12px' }}>
            <CheckCircle2 size={18} style={{ color: '#10B981' }} />
            History ({revisionLogs.length})
          </h3>
          {revisionLogs.length === 0 ? (
            <div className="revision-info-box">
              <AlertCircle size={16} />
              No revision history yet. Complete your first revision.
            </div>
          ) : (
            <div className="revision-history-list">
              {revisionLogs.slice(0, 10).map((log) => {
                const matchingNote = notes.find(n => n.id === log.noteId);
                return (
                  <div key={log.id} className="revision-history-item">
                    <div className="revision-history-left">
                      <div className={`revision-history-dot ${log.rating}`} />
                      <span className="revision-history-title">{matchingNote ? matchingNote.title : 'Deleted'}</span>
                    </div>
                    <div className="revision-history-right">
                      <span className="revision-history-rating" style={{ color: log.rating === 'easy' ? '#10B981' : log.rating === 'medium' ? '#3B82F6' : '#EF4444' }}>
                        {log.rating.toUpperCase()}
                      </span>
                      <span className="revision-history-date">
                        {formatShortDate(log.revisedAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
