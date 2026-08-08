'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store/useStore';
import {
  Zap, Trophy, Flame, Target, Crown, Coins,
  TrendingUp, CalendarDays, Sparkles, CheckCircle, Gift,
  Lock, GiftIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WEEKDAYS } from '@/lib/constants';
import { getXpLevel, getMonthlyReport } from '@/lib/gamification';

const ALL_ACHIEVEMENTS = [
  { id: 'first-note', label: 'First Note', emoji: '📝', description: 'Create your first study note', xpReward: 50, coinReward: 10 },
  { id: 'note-collector', label: '10 Notes', emoji: '📚', description: 'Create 10 study notes', xpReward: 150, coinReward: 30 },
  { id: 'note-master', label: '25 Notes', emoji: '🏛️', description: 'Create 25 study notes', xpReward: 400, coinReward: 80 },
  { id: 'first-revision', label: 'First Review', emoji: '✅', description: 'Complete your first revision', xpReward: 50, coinReward: 10 },
  { id: 'revision-streak', label: 'Streak 7', emoji: '🔥', description: 'Maintain a 7-day streak', xpReward: 200, coinReward: 50 },
  { id: 'revision-grind', label: 'Streak 30', emoji: '💪', description: 'Maintain a 30-day streak', xpReward: 1000, coinReward: 200 },
  { id: 'voice-pioneer', label: 'Voice Note', emoji: '🎤', description: 'Record your first voice note', xpReward: 50, coinReward: 10 },
  { id: 'xp-hunter', label: 'Level 5', emoji: '⭐', description: 'Reach level 5', xpReward: 300, coinReward: 60 },
  { id: 'xp-legend', label: 'Level 10', emoji: '👑', description: 'Reach level 10', xpReward: 1000, coinReward: 200 },
  { id: 'daily-dedication', label: 'Daily Goal', emoji: '🎯', description: 'Complete your daily goal 7 times', xpReward: 500, coinReward: 100 },
  { id: 'coin-hoarder', label: '50 Coins', emoji: '🪙', description: 'Earn 50 study coins', xpReward: 100, coinReward: 0 },
  { id: 'coin-king', label: '200 Coins', emoji: '💰', description: 'Earn 200 study coins', xpReward: 500, coinReward: 0 },
];

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'StudyMaster99', xp: 8450, level: 9, avatar: '🧑‍🎓' },
  { rank: 2, name: 'QuizWhiz', xp: 7200, level: 8, avatar: '🧠' },
  { rank: 3, name: 'NoteTakerPro', xp: 6100, level: 7, avatar: '📖' },
  { rank: 4, name: 'RevisionKing', xp: 5400, level: 7, avatar: '👑' },
  { rank: 5, name: 'FlashcardFan', xp: 4800, level: 6, avatar: '🃏' },
  { rank: 6, name: 'StreakRunner', xp: 3900, level: 6, avatar: '🏃' },
  { rank: 7, name: 'VoiceNoteStar', xp: 3100, level: 5, avatar: '🎤' },
  { rank: 8, name: 'StudyBuddy', xp: 2500, level: 5, avatar: '🤝' },
];

function generateWeeklyChallenge(): { id: string; label: string; description: string; target: number; xpReward: number; coinReward: number } {
  const challenges = [
    { label: 'Note Machine', description: 'Create notes this week', target: 10, xpReward: 500, coinReward: 100 },
    { label: 'Revision Rush', description: 'Complete revisions this week', target: 15, xpReward: 600, coinReward: 120 },
    { label: 'Voice Hero', description: 'Record voice notes this week', target: 5, xpReward: 400, coinReward: 80 },
    { label: 'Streak Defender', description: 'Study every day this week', target: 7, xpReward: 700, coinReward: 150 },
    { label: 'Quiz Master', description: 'Generate quizzes this week', target: 3, xpReward: 300, coinReward: 60 },
  ];
  return { id: 'weekly-challenge', ...challenges[Math.floor(Math.random() * challenges.length)] };
}

export default function GamificationHub() {
  const notes = useStore((s) => s.notes);
  const voiceNotes = useStore((s) => s.voiceNotes);
  const revisionLogs = useStore((s) => s.revisionLogs);
  const coins = useStore((s) => s.coins);
  const earnedAchievements = useStore((s) => s.earnedAchievements);
  const earnAchievement = useStore((s) => s.earnAchievement);
  const addCoins = useStore((s) => s.addCoins);
  const weeklyChallenge = useStore((s) => s.weeklyChallenge);
  const setWeeklyChallenge = useStore((s) => s.setWeeklyChallenge);
  const dailyGoal = useStore((s) => s.dailyGoal);
  const dailyProgress = useStore((s) => s.dailyProgress);
  const checkAndResetDaily = useStore((s) => s.checkAndResetDaily);
  const user = useStore((s) => s.user);

  const [showReward, setShowReward] = useState<{ xp: number; coins: number; message: string } | null>(null);
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState<'global' | 'friends'>('global');

  useEffect(() => { checkAndResetDaily(); }, [checkAndResetDaily]);

  useEffect(() => {
    if (!weeklyChallenge) {
      const challenge = generateWeeklyChallenge();
      setWeeklyChallenge({ ...challenge, progress: 0, weekStart: new Date().toISOString().split('T')[0] });
    }
  }, [weeklyChallenge, setWeeklyChallenge]);

  const xp = useMemo(() => {
    return notes.length * 10 + voiceNotes.length * 15 + revisionLogs.length * 20 + (user.streakCount || 0) * 5;
  }, [notes.length, voiceNotes.length, revisionLogs.length, user.streakCount]);

  const { level, progress, next } = getXpLevel(xp);
  const totalRevised = notes.filter(n => n.revisionStreak > 0).length;

  const achievements = useMemo(() => ALL_ACHIEVEMENTS.map(a => ({
    ...a,
    earned: earnedAchievements.includes(a.id),
    canEarn: (
      (a.id === 'first-note' && notes.length >= 1) ||
      (a.id === 'note-collector' && notes.length >= 10) ||
      (a.id === 'note-master' && notes.length >= 25) ||
      (a.id === 'first-revision' && totalRevised >= 1) ||
      (a.id === 'revision-streak' && (user.streakCount || 0) >= 7) ||
      (a.id === 'revision-grind' && (user.streakCount || 0) >= 30) ||
      (a.id === 'voice-pioneer' && voiceNotes.length >= 1) ||
      (a.id === 'xp-hunter' && level >= 5) ||
      (a.id === 'xp-legend' && level >= 10) ||
      (a.id === 'daily-dedication' && dailyProgress >= dailyGoal * 7) ||
      (a.id === 'coin-hoarder' && coins >= 50) ||
      (a.id === 'coin-king' && coins >= 200)
    )
  })), [notes.length, totalRevised, user.streakCount, voiceNotes.length, level, dailyProgress, dailyGoal, coins, earnedAchievements]);

  const earnedCount = achievements.filter(a => a.earned).length;

  const monthlyReport = useMemo(() => getMonthlyReport(revisionLogs), [revisionLogs]);
  const maxMonthly = Math.max(...monthlyReport.map(([, c]) => c), 1);

  const weeklyHours = useMemo(() => {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    for (const log of revisionLogs) {
      const d = new Date(log.revisedAt);
      if (d >= weekStart) {
        const day = (d.getDay() + 6) % 7;
        dayCounts[day]++;
      }
    }
    const max = Math.max(...dayCounts, 1);
    return dayCounts.map((c, i) => ({
      day: WEEKDAYS[i],
      count: c,
      pct: (c / max) * 100,
    }));
  }, [revisionLogs]);

  const weeklyCount = weeklyHours.reduce((s, h) => s + h.count, 0);

  const triggerReward = useCallback((xpAmt: number, coinAmt: number, msg: string) => {
    setShowReward({ xp: xpAmt, coins: coinAmt, message: msg });
    addCoins(coinAmt);
    confetti({ particleCount: 40, spread: 60, colors: ['#0061A4', '#F59E0B', '#10B981'] });
    setTimeout(() => setShowReward(null), 3000);
  }, [addCoins]);

  const handleClaimAchievement = (id: string) => {
    if (earnedAchievements.includes(id)) return;
    const ach = achievements.find(a => a.id === id);
    if (!ach || !ach.canEarn) return;
    earnAchievement(id);
    triggerReward(ach.xpReward, ach.coinReward, `Achievement Unlocked: ${ach.label}`);
  };

  const userRank = 420;
  const userDisplayName = user.name || 'You';
  const fullLeaderboard = [
    ...MOCK_LEADERBOARD,
    { rank: userRank, name: userDisplayName, xp, level, avatar: '🌟' },
  ].sort((a, b) => b.xp - a.xp).slice(0, 10).map((entry, idx) => ({ ...entry, rank: idx + 1 }));

  return (
    <div className="game-container">
      {/* ─── XP Header ─── */}
      <div className="game-xp-header">
        <div className="game-xp-left">
          <div className="game-level-ring">
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
              <circle cx="32" cy="32" r="27" fill="none" stroke="#fff" strokeWidth="5"
                strokeDasharray={`${2 * Math.PI * 27}`}
                strokeDashoffset={`${2 * Math.PI * 27 * (1 - progress / 100)}`}
                strokeLinecap="round" transform="rotate(-90 32 32)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="game-level-center">
              <span className="game-level-num">{level}</span>
            </div>
          </div>
          <div>
            <div className="game-xp-label">Level {level}</div>
            <div className="game-xp-value">{xp} XP</div>
            <div className="game-xp-next">{next - xp} XP to next level</div>
          </div>
        </div>
        <div className="game-xp-right">
          <div className="game-coins-badge">
            <Coins size={16} />
            <span>{coins}</span>
          </div>
          <div className="game-streak-badge">
            <Flame size={16} />
            <span>{user.streakCount || 0}</span>
          </div>
        </div>
      </div>

      {/* ─── Daily Goal ─── */}
      <div className="game-daily-card">
        <div className="game-daily-header">
          <Target size={16} />
          Daily Goal
          <span className="game-daily-count">{dailyProgress}/{dailyGoal}</span>
        </div>
        <div className="game-daily-track">
          <div className="game-daily-fill" style={{ width: `${Math.min((dailyProgress / dailyGoal) * 100, 100)}%` }} />
        </div>
        <div className="game-daily-stars">
          {Array.from({ length: dailyGoal }, (_, i) => (
            <span key={i} className={`game-star ${i < dailyProgress ? 'filled' : ''}`}>
              {i < dailyProgress ? '⭐' : '☆'}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Weekly Challenge ─── */}
      {weeklyChallenge && (
        <div className="game-weekly-card">
          <div className="game-weekly-header">
            <Gift size={16} />
            Weekly Challenge
            <span className="game-weekly-count">{weeklyChallenge.progress}/{weeklyChallenge.target}</span>
          </div>
          <div className="game-weekly-title">{weeklyChallenge.label}</div>
          <div className="game-weekly-desc">{weeklyChallenge.description}</div>
          <div className="game-weekly-track">
            <div className="game-weekly-fill" style={{ width: `${Math.min((weeklyChallenge.progress / weeklyChallenge.target) * 100, 100)}%` }} />
          </div>
          <div className="game-weekly-reward">
            <Zap size={12} /> +{weeklyChallenge.xpReward} XP
            <span style={{ marginLeft: '12px' }}><Coins size={12} /> +{weeklyChallenge.coinReward}</span>
          </div>
        </div>
      )}

      {/* ─── Weekly Hours + Monthly Report ─── */}
      <div className="game-charts-grid">
        <div className="game-chart-card">
          <div className="game-chart-header">
            <TrendingUp size={14} />
            This Week
            <span className="game-chart-count">{weeklyCount} sessions</span>
          </div>
          <div className="game-weekly-chart">
            {weeklyHours.map((h, i) => (
              <div key={i} className="game-weekly-col" title={`${h.day}: ${h.count}`}>
                <div className="game-weekly-bar-wrapper">
                  <div className="game-weekly-bar" style={{ height: `${Math.max(h.pct, 8)}%` }} />
                </div>
                <span className="game-weekly-label">{h.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="game-chart-card">
          <div className="game-chart-header">
            <CalendarDays size={14} />
            Monthly
            <span className="game-chart-count">{revisionLogs.length} total</span>
          </div>
          {monthlyReport.length > 0 ? (
            <div className="game-monthly-chart">
              {monthlyReport.map(([month, count]) => (
                <div key={month} className="game-monthly-col">
                  <span className="game-monthly-count">{count}</span>
                  <div className="game-monthly-bar-wrapper">
                    <div className="game-monthly-bar" style={{ height: `${(count / maxMonthly) * 100}%` }} />
                  </div>
                  <span className="game-monthly-label">{month}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="game-empty-chart">
              <CalendarDays size={24} style={{ opacity: 0.3 }} />
              <span>No data yet</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Achievements ─── */}
      <div className="game-section">
        <div className="game-section-header">
          <Trophy size={16} style={{ color: 'var(--primary)' }} />
          Achievements
          <span className="game-section-count">{earnedCount}/{achievements.length}</span>
          <button className="game-section-toggle" onClick={() => setShowAllAchievements(!showAllAchievements)}>
            {showAllAchievements ? 'Show Less' : 'Show All'}
          </button>
        </div>
        <div className="game-achievements-grid">
          {(showAllAchievements ? achievements : achievements.slice(0, 6)).map(a => (
            <div key={a.id} className={`game-achievement ${a.earned ? 'earned' : ''} ${a.canEarn && !a.earned ? 'claimable' : ''}`}>
              <div className="game-achievement-emoji">{a.emoji}</div>
              <div className="game-achievement-info">
                <div className="game-achievement-label">{a.label}</div>
                <div className="game-achievement-desc">{a.description}</div>
                <div className="game-achievement-reward">
                  <Zap size={10} /> +{a.xpReward} <Coins size={10} /> +{a.coinReward}
                </div>
              </div>
              {a.earned ? (
                <CheckCircle size={18} className="game-achievement-check" />
              ) : a.canEarn ? (
                <button className="game-claim-btn" onClick={() => handleClaimAchievement(a.id)}>
                  <GiftIcon size={14} /> Claim
                </button>
              ) : (
                <Lock size={14} className="game-achievement-lock" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Leaderboard ─── */}
      <div className="game-section">
        <div className="game-section-header">
          <Crown size={16} style={{ color: '#F59E0B' }} />
          Leaderboard
          <div className="game-leaderboard-tabs">
            <button className={`game-lb-tab ${leaderboardTab === 'global' ? 'active' : ''}`} onClick={() => setLeaderboardTab('global')}>Global</button>
            <button className={`game-lb-tab ${leaderboardTab === 'friends' ? 'active' : ''}`} onClick={() => setLeaderboardTab('friends')}>Friends</button>
          </div>
        </div>
        <div className="game-leaderboard">
          {fullLeaderboard.map((entry) => {
            const isUser = entry.name === userDisplayName;
            return (
              <div key={entry.rank} className={`game-lb-row ${isUser ? 'highlight' : ''}`}>
                <span className={`game-lb-rank ${entry.rank <= 3 ? 'top' : ''}`}>
                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                </span>
                <span className="game-lb-avatar">{entry.avatar}</span>
                <span className="game-lb-name">{entry.name}{isUser && ' (You)'}</span>
                <span className="game-lb-level">Lv.{entry.level}</span>
                <span className="game-lb-xp">{entry.xp.toLocaleString()} XP</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Animated Reward Overlay ─── */}
      {showReward && (
        <div className="game-reward-overlay" role="dialog" aria-modal="true" aria-labelledby="reward-title" onClick={() => setShowReward(null)}>
          <div className="game-reward-card">
            <div className="game-reward-icon">
              <Sparkles size={32} />
            </div>
            <div id="reward-title" className="game-reward-message">{showReward.message}</div>
            <div className="game-reward-items">
              {showReward.xp > 0 && (
                <div className="game-reward-item">
                  <Zap size={20} /> +{showReward.xp} XP
                </div>
              )}
              {showReward.coins > 0 && (
                <div className="game-reward-item">
                  <Coins size={20} /> +{showReward.coins}
                </div>
              )}
            </div>
            <div className="game-reward-close">Tap to continue</div>
          </div>
        </div>
      )}
    </div>
  );
}
