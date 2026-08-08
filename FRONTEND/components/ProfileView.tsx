'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store/useStore';
import {
  User, School, BookOpen, GraduationCap, Award, CheckCircle, FileText, Music, Sparkles,
  TrendingUp, Clock, Target, Flame, Zap, Trophy, BarChart3, CalendarDays
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WEEKDAYS } from '@/lib/constants';
import { getXpLevel, getMonthlyReport } from '@/lib/gamification';

interface Badge {
  id: string;
  label: string;
  emoji: string;
  earned: boolean;
  color: string;
}

export default function ProfileView() {
  const user = useStore((s) => s.user);
  const notes = useStore((s) => s.notes);
  const voiceNotes = useStore((s) => s.voiceNotes);
  const revisionLogs = useStore((s) => s.revisionLogs);
  const updateProfile = useStore((s) => s.updateProfile);

  const [name, setName] = useState(user.name);
  const [college, setCollege] = useState(user.college);
  const [field, setField] = useState(user.field);
  const [semester, setSemester] = useState(user.semester);
  const [studyGoals, setStudyGoals] = useState(user.studyGoals);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ name, college, field, semester, studyGoals });
    setIsEditing(false);
    confetti({ particleCount: 50, colors: ['#0061A4', '#10B981'] });
  };

  const totalNotes = notes.length;
  const totalVoiceNotes = voiceNotes.length;
  const totalRevised = notes.filter(n => n.revisionStreak > 0).length;
  const streakDays = user.streakCount || 0;

  const xp = useMemo(() => {
    return totalNotes * 10 + totalVoiceNotes * 15 + revisionLogs.length * 20 + streakDays * 5;
  }, [totalNotes, totalVoiceNotes, revisionLogs.length, streakDays]);

  const { level, progress, next: nextXp } = getXpLevel(xp);
  const completionPct = totalNotes > 0 ? Math.round((totalRevised / totalNotes) * 100) : 0;

  const weeklyHours = useMemo(() => {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const log of revisionLogs) {
      const d = new Date(log.revisedAt);
      const day = (d.getDay() + 6) % 7;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
    const max = Math.max(...dayCounts, 1);
    return dayCounts.map((c, i) => ({
      day: WEEKDAYS[i],
      hours: parseFloat((c * 0.5).toFixed(1)),
      raw: c,
      pct: (c / max) * 100,
    }));
  }, [revisionLogs]);

  const badges: Badge[] = useMemo(() => [
    { id: 'first-note', label: 'First Note', emoji: '📝', earned: totalNotes >= 1, color: '#3B82F6' },
    { id: 'note-collector', label: '10 Notes', emoji: '📚', earned: totalNotes >= 10, color: '#8B5CF6' },
    { id: 'note-master', label: '25 Notes', emoji: '🏛️', earned: totalNotes >= 25, color: '#EC4899' },
    { id: 'first-revision', label: 'First Review', emoji: '✅', earned: totalRevised >= 1, color: '#10B981' },
    { id: 'revision-streak', label: 'Streak 7', emoji: '🔥', earned: streakDays >= 7, color: '#F59E0B' },
    { id: 'revision-grind', label: 'Streak 30', emoji: '💪', earned: streakDays >= 30, color: '#EF4444' },
    { id: 'voice-pioneer', label: 'Voice Note', emoji: '🎤', earned: totalVoiceNotes >= 1, color: '#06B6D4' },
    { id: 'xp-hunter', label: 'Level 5', emoji: '⭐', earned: level >= 5, color: '#F97316' },
    { id: 'xp-legend', label: 'Level 10', emoji: '👑', earned: level >= 10, color: '#D946EF' },
    { id: 'perfect-week', label: '7-Day Streak', emoji: '📅', earned: false, color: '#84CC16' },
  ], [totalNotes, totalRevised, streakDays, totalVoiceNotes, level]);

  const earnedBadges = badges.filter(b => b.earned).length;
  const monthlyReport = useMemo(() => getMonthlyReport(revisionLogs, true), [revisionLogs]);
  const maxMonthly = Math.max(...monthlyReport.map(([, c]) => c), 1);

  const totalHours = weeklyHours.reduce((s, h) => s + h.hours, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>

      {/* ─── Profile Header ─── */}
      <div className="premium-card">
        {isEditing ? (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={18} style={{ color: 'var(--primary)' }} /> Edit Profile
            </h2>            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600 }}>Your Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="md3-input" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600 }}>School / College</label>
              <input type="text" placeholder="e.g. Delhi University" value={college} onChange={e => setCollege(e.target.value)} className="md3-input" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600 }}>Field of Study</label>
              <input type="text" placeholder="e.g. Science, Commerce, Engineering" value={field} onChange={e => setField(e.target.value)} className="md3-input" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600 }}>Class / Semester</label>
              <input type="text" placeholder="e.g. Class 10, Semester 2" value={semester} onChange={e => setSemester(e.target.value)} className="md3-input" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600 }}>Study Goals</label>
              <textarea value={studyGoals} onChange={e => setStudyGoals(e.target.value)} required rows={3} className="md3-input" style={{ resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button type="button" onClick={() => setIsEditing(false)} className="md3-btn md3-btn-text">Cancel</button>
              <button type="submit" className="md3-btn md3-btn-primary">Save</button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={20} style={{ color: 'var(--primary)' }} />
                Student Profile
              </h2>
              <button onClick={() => setIsEditing(true)} className="md3-btn md3-btn-secondary" style={{ fontSize: '12px', padding: '6px 14px' }}>
                Edit
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-title)' }}>{user.name}</div>
              {user.college && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--on-surface-variant)' }}><School size={14} /> {user.college}</div>}
              {user.field && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--on-surface-variant)' }}><BookOpen size={14} /> {user.field}</div>}
              {user.semester && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--on-surface-variant)' }}><GraduationCap size={14} /> {user.semester}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                <Award size={14} /> {user.studyGoals}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Stats Row ─── */}
      <div className="profile-stats-row">
        <div className="profile-stat-card">
          <div className="profile-stat-icon" style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}><FileText size={18} /></div>
          <div><div className="profile-stat-value">{totalNotes}</div><div className="profile-stat-label">Notes</div></div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-icon" style={{ background: 'var(--tertiary-container)', color: 'var(--tertiary)' }}><Music size={18} /></div>
          <div><div className="profile-stat-value">{totalVoiceNotes}</div><div className="profile-stat-label">Voice</div></div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}><CheckCircle size={18} /></div>
          <div><div className="profile-stat-value">{totalRevised}</div><div className="profile-stat-label">Revised</div></div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}><Flame size={18} /></div>
          <div><div className="profile-stat-value">{streakDays}</div><div className="profile-stat-label">Day Streak</div></div>
        </div>
      </div>

      {/* ─── Study Analytics ─── */}
      <div>
        <h3 className="profile-section-title">
          <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
          Study Analytics
        </h3>

        <div className="profile-analytics-grid">
          {/* Weekly Hours Chart */}
          <div className="profile-analytics-card">
            <div className="profile-analytics-card-header">
              <Clock size={16} />
              Weekly Hours
              <span className="profile-analytics-total">{totalHours.toFixed(1)}h</span>
            </div>
            <div className="profile-weekly-chart">
              {weeklyHours.map((h, i) => (
                <div key={i} className="profile-weekly-col" title={`${h.day}: ${h.hours}h`}>
                  <div className="profile-weekly-bar-wrapper">
                    <div className="profile-weekly-bar" style={{ height: `${Math.max(h.pct, 8)}%` }} />
                  </div>
                  <span className="profile-weekly-label">{h.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* XP Level */}
          <div className="profile-analytics-card">
            <div className="profile-analytics-card-header">
              <Zap size={16} />
              XP Level
              <span className="profile-analytics-total">Lv.{level}</span>
            </div>
            <div className="profile-xp-body">
              <div className="profile-xp-ring">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--outline-variant)" strokeWidth="6" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--primary)" strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                    strokeLinecap="round" transform="rotate(-90 40 40)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                </svg>
                <div className="profile-xp-center">
                  <div className="profile-xp-value">{xp}</div>
                  <div className="profile-xp-label">XP</div>
                </div>
              </div>
              <div className="profile-xp-info">
                <div className="profile-xp-text">{xp} / {nextXp} XP</div>
                <div className="profile-xp-next">Next level: {nextXp - xp} XP away</div>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="profile-analytics-card profile-analytics-card-wide">
            <div className="profile-analytics-card-header">
              <Trophy size={16} />
              Badges
              <span className="profile-analytics-total">{earnedBadges}/{badges.length}</span>
            </div>
            <div className="profile-badges-grid">
              {badges.map(b => (
                <div key={b.id} className={`profile-badge ${b.earned ? 'earned' : ''}`} title={b.label}>
                  <span className="profile-badge-emoji" style={{ opacity: b.earned ? 1 : 0.25, filter: b.earned ? 'none' : 'grayscale(1)' }}>{b.emoji}</span>
                  <span className="profile-badge-label">{b.label}</span>
                  {!b.earned && <span className="profile-badge-locked">🔒</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Longest Streak + Completion % */}
          <div className="profile-analytics-card">
            <div className="profile-analytics-card-header">
              <Flame size={16} />
              Longest Streak
            </div>
            <div className="profile-streak-body">
              <span className="profile-streak-number">{streakDays}</span>
              <span className="profile-streak-unit">days</span>
            </div>
            <div className="profile-streak-sub">Current active streak</div>
          </div>

          <div className="profile-analytics-card">
            <div className="profile-analytics-card-header">
              <Target size={16} />
              Completion
            </div>
            <div className="profile-completion-body">
              <div className="profile-completion-ring">
                <svg width="72" height="72" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="30" fill="none" stroke="var(--outline-variant)" strokeWidth="6" />
                  <circle cx="36" cy="36" r="30" fill="none" stroke="#10B981" strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 30}`}
                    strokeDashoffset={`${2 * Math.PI * 30 * (1 - completionPct / 100)}`}
                    strokeLinecap="round" transform="rotate(-90 36 36)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                </svg>
                <div className="profile-completion-center">
                  <span className="profile-completion-value">{completionPct}%</span>
                </div>
              </div>
              <div className="profile-completion-text">
                {totalRevised} of {totalNotes} notes revised
              </div>
            </div>
          </div>

          {/* Monthly Report */}
          <div className="profile-analytics-card profile-analytics-card-wide">
            <div className="profile-analytics-card-header">
              <CalendarDays size={16} />
              Monthly Report
              <span className="profile-analytics-total">{revisionLogs.length} total</span>
            </div>
            {monthlyReport.length > 0 ? (
              <div className="profile-monthly-chart">
                {monthlyReport.map(([month, count]) => (
                  <div key={month} className="profile-monthly-col">
                    <span className="profile-monthly-count">{count}</span>
                    <div className="profile-monthly-bar-wrapper">
                      <div className="profile-monthly-bar" style={{ height: `${(count / maxMonthly) * 100}%` }} />
                    </div>
                    <span className="profile-monthly-label">{month}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="profile-empty-chart">
                <BarChart3 size={32} style={{ color: 'var(--outline)', opacity: 0.4 }} />
                <span style={{ fontSize: '13px', color: 'var(--outline)' }}>Start revising to see your monthly report</span>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
