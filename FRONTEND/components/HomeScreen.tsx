'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store/useStore';
import {
  Sparkles, BookOpen, FileText, Clock,
  Target, ChevronRight, Play, BarChart3,
  CheckCircle2, Flame, Plus, Search, Star, Pin, Trash2,
  Layers, FolderPlus, Grid3X3, List, Lock, ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import EmptyState, { EmptyNotesIllustration } from './EmptyState';
import HeroAI from './HeroAI';
import { WEEKDAYS, DAILY_GOAL, AI_TOOLS } from '@/lib/constants';
import { formatShortDate, stripHtml } from '@/lib/utils';

interface HomeScreenProps {
  onEditNote: (noteId: string) => void;
  onCreateNote: () => void;
  onNavigate: (tab: string) => void;
}

const QUOTES = [
  { text: "The only way to learn mathematics is to do mathematics.", author: "Paul Halmos" },
  { text: "Study hard what interests you the most in the most undisciplined manner possible.", author: "Richard Feynman" },
  { text: "The beautiful thing about learning is that nobody can take it away from you.", author: "B.B. King" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" },
  { text: "Tell me and I forget. Teach me and I remember. Involve me and I learn.", author: "Benjamin Franklin" },
];

const DAY_OF_YEAR = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
const TODAY_QUOTE = QUOTES[DAY_OF_YEAR % QUOTES.length];

function CircularProgress({ value, max, size = 80, strokeWidth = 6, color = 'var(--primary)' }: { value: number; max: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const offset = circumference * (1 - progress);

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--outline-variant)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  );
}

export default function HomeScreen({ onEditNote, onCreateNote, onNavigate }: HomeScreenProps) {
  const user = useStore((s) => s.user);
  const notes = useStore((s) => s.notes);
  const categories = useStore((s) => s.categories);
  const folders = useStore((s) => s.folders);
  const activeFolderId = useStore((s) => s.activeFolderId);
  const activeCategoryId = useStore((s) => s.activeCategoryId);
  const searchQuery = useStore((s) => s.searchQuery);
  const addFolder = useStore((s) => s.addFolder);
  const addCategory = useStore((s) => s.addCategory);
  const deleteFolder = useStore((s) => s.deleteFolder);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const setActiveFolderId = useStore((s) => s.setActiveFolderId);
  const setActiveCategoryId = useStore((s) => s.setActiveCategoryId);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const deleteNote = useStore((s) => s.deleteNote);
  const markAsRevised = useStore((s) => s.markAsRevised);
  const incrementStreak = useStore((s) => s.incrementStreak);
  const setActiveAiTool = useStore((s) => s.setActiveAiTool);

  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#0061A4');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [unlockNoteId, setUnlockNoteId] = useState<string | null>(null);
  const [pinError, setPinError] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const filteredNotes = useMemo(() => notes.filter((note) => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          note.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFolder = activeFolderId ? note.folderId === activeFolderId : true;
    const matchesCategory = activeCategoryId ? note.categoryId === activeCategoryId : true;
    return matchesSearch && matchesFolder && matchesCategory;
  }), [notes, searchQuery, activeFolderId, activeCategoryId]);

  const pinnedNotes = useMemo(() => filteredNotes.filter(n => n.isPinned), [filteredNotes]);
  const unpinnedNotes = useMemo(() => filteredNotes.filter(n => !n.isPinned), [filteredNotes]);
  const displayNotes = useMemo(() => [...pinnedNotes, ...unpinnedNotes], [pinnedNotes, unpinnedNotes]);

  const dueRevisionNotes = useMemo(() => notes.filter((note) => {
      if (!note.nextRevisionAt) return false;
      return new Date(note.nextRevisionAt) <= new Date();
    }), [notes]);

  const recentNotes = useMemo(() => [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 6), [notes]);

  const totalNotes = notes.length;
  const totalRevised = useMemo(() => notes.filter(n => n.revisionStreak > 0).length, [notes]);
  const totalPinned = useMemo(() => notes.filter(n => n.isPinned).length, [notes]);
  const totalFavorites = useMemo(() => notes.filter(n => n.isFavorite).length, [notes]);

  const dailyProgress = useMemo(() => Math.min(notes.filter(n => {
    return n.updatedAt.startsWith(new Date().toISOString().split('T')[0]);
  }).length, DAILY_GOAL), [notes]);

  const weeklyData = useMemo(() => {
    const today = new Date();
    return WEEKDAYS.map((day, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const dayStr = d.toISOString().split('T')[0];
      const count = notes.filter(n => n.updatedAt.startsWith(dayStr)).length;
      return { day, count };
    });
  }, [notes]);
  const weeklyMax = Math.max(...weeklyData.map(d => d.count), 3);

  const lastEditedNote = useMemo(() => [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0], [notes]);

  const handleStreakClick = () => {
    incrementStreak();
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* ─── Productivity Hero Dashboard ─── */}
      <div className="ai-hero animate-fade-in">
        <div className="ai-hero-bg" />
        <div className="hero-dashboard">
          {/* Top Row: Greeting + Streak + Quick Actions */}
          <div className="hero-top-row">
            <div className="hero-greeting">
              <span className="ai-badge">
                <Sparkles size={12} /> AI-Powered Study Companion
              </span>
              <h2 className="hero-title">
                Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user.name.split(' ')[0]}!
              </h2>
              <p className="hero-subtitle">{user.studyGoals}</p>
            </div>
            <div className="hero-actions-row">
              <button onClick={handleStreakClick} className="streak-btn">
                <Flame size={22} color="#FBBF24" fill="#FBBF24" />
                <div>
                  <div className="streak-count">{user.streakCount}</div>
                  <div className="streak-label">day streak</div>
                </div>
              </button>
              <button onClick={() => onNavigate('ai')} className="hero-ghost-btn">
                <Sparkles size={15} /> Ask SnapAI
              </button>
            </div>
          </div>

          {/* Middle Row: Goal, Revision, Continue */}
          <div className="hero-metrics-row">
            {/* Today's Goal */}
            <div className="hero-metric-card">
              <div className="hero-metric-header">
                <Target size={15} />
                <span>Today&apos;s Goal</span>
              </div>
              <div className="hero-goal-body">
                <div className="hero-ring-container">
                  <CircularProgress value={dailyProgress} max={DAILY_GOAL} size={64} strokeWidth={6} color="#ffffff" />
                  <div className="hero-ring-label">
                    <div className="hero-ring-value">{dailyProgress}</div>
                    <div className="hero-ring-divider">/{DAILY_GOAL}</div>
                  </div>
                </div>
                <div className="hero-goal-info">
                  <div className="hero-goal-text">
                    {dailyProgress >= DAILY_GOAL ? 'Goal completed! 🎉' : `${DAILY_GOAL - dailyProgress} more to go`}
                  </div>
                  <div className="hero-progress-track">
                    <div className="hero-progress-fill" style={{ width: `${(dailyProgress / DAILY_GOAL) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Continue Last Note */}
            <div className="hero-metric-card">
              <div className="hero-metric-header">
                <Play size={15} />
                <span>Continue Last Note</span>
              </div>
              {lastEditedNote ? (
                <div className="hero-continue-body" onClick={() => onEditNote(lastEditedNote.id)}>
                  <div className="hero-continue-icon">
                    <BookOpen size={18} />
                  </div>
                  <div className="hero-continue-content">
                    <div className="hero-continue-title">{lastEditedNote.title}</div>
                    <div className="hero-continue-meta">
                      {lastEditedNote.tags[0] && <span>#{lastEditedNote.tags[0]}</span>}
                      <span>{formatShortDate(lastEditedNote.updatedAt)}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="hero-chevron" />
                </div>
              ) : (
                <div className="hero-continue-empty" onClick={onCreateNote}>
                  <Plus size={18} />
                  <span>Create your first note</span>
                </div>
              )}
            </div>

            {/* Today's Revision */}
            <div className="hero-metric-card">
              <div className="hero-metric-header">
                <Clock size={15} />
                <span>Today&apos;s Revision</span>
                {dueRevisionNotes.length > 0 && (
                  <span className="hero-due-badge">{dueRevisionNotes.length} due</span>
                )}
              </div>
              {dueRevisionNotes.length === 0 ? (
                <div className="hero-revision-empty">
                  <CheckCircle2 size={18} />
                  <span>All caught up!</span>
                </div>
              ) : (
                <div className="hero-revision-list">
                  {dueRevisionNotes.slice(0, 2).map((note) => (
                    <div key={note.id} className="hero-revision-item" onClick={() => onEditNote(note.id)}>
                      <div className="hero-revision-info">
                        <div className="hero-revision-title">{note.title}</div>
                        <div className="hero-revision-streak">Streak {note.revisionStreak}x</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); markAsRevised(note.id, 'easy'); confetti({ particleCount: 20, colors: ['#10B981'] }); }} className="hero-revise-btn">
                        <CheckCircle2 size={12} /> Revise
                      </button>
                    </div>
                  ))}
                  {dueRevisionNotes.length > 2 && (
                    <div className="hero-revision-more" onClick={() => onNavigate('calendar')}>
                      +{dueRevisionNotes.length - 2} more due
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom: Motivational Quote */}
          <div className="hero-quote-row">
            <span className="hero-quote-icon">&quot;</span>
            <div className="hero-quote-content">
              <p className="hero-quote-text">{TODAY_QUOTE.text}</p>
              <span className="hero-quote-author">— {TODAY_QUOTE.author}</span>
            </div>
          </div>
        </div>
      </div>

      <HeroAI onNavigate={onNavigate} />

      {/* ─── Stats Grid ─── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #d1e4ff, #e8f0fe)' }}>
            <FileText size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <div className="stat-value">{totalNotes}</div>
            <div className="stat-label">Total Notes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' }}>
            <CheckCircle2 size={18} style={{ color: '#059669' }} />
          </div>
          <div>
            <div className="stat-value">{totalRevised}</div>
            <div className="stat-label">Revised</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)' }}>
            <Pin size={18} style={{ color: '#D97706' }} />
          </div>
          <div>
            <div className="stat-value">{totalPinned}</div>
            <div className="stat-label">Pinned</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #fce7f3, #fbcfe8)' }}>
            <Star size={18} style={{ color: '#DB2777' }} />
          </div>
          <div>
            <div className="stat-value">{totalFavorites}</div>
            <div className="stat-label">Favorites</div>
          </div>
        </div>
      </div>

      {/* ─── AI Study Tools ─── */}
      <div id="ai-tools-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Sparkles size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '17px', fontWeight: 700 }}>✨ AI Study Tools</h3>
        </div>
        <div className="ai-tools-grid">
          {AI_TOOLS.map((tool, index) => (
            <motion.button
              key={tool.id}
              className="ai-tool-card"
              onClick={() => { setActiveAiTool(tool.id); onNavigate('ai'); }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.35, ease: 'easeOut' }}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.97 }}
              style={{ '--tool-gradient': tool.gradient } as React.CSSProperties}
            >
              <span className="ai-tool-emoji">{tool.emoji}</span>
              <div className="ai-tool-info">
                <div className="ai-tool-title">{tool.title}</div>
                <div className="ai-tool-desc">{tool.desc}</div>
              </div>
              <div className="ai-tool-ripple" />
            </motion.button>
          ))}
        </div>
        <motion.button
          className="ai-tools-explore-btn"
          onClick={() => onNavigate('ai')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Sparkles size={14} />
          Explore all AI Tools
          <ArrowRight size={14} />
        </motion.button>
      </div>

      {/* ─── Recent Notes + Weekly Progress Row ─── */}
      <div className="dashboard-row">
        {/* Recent Notes */}
        <div className="dashboard-card" style={{ flex: '1 1 60%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <BookOpen size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Recent Notes</h3>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--on-surface-variant)' }}>{notes.length} total</span>
          </div>
          {recentNotes.length === 0 ? (
            <EmptyState
              illustration={<EmptyNotesIllustration />}
              title="Your Canvas is Empty"
              message="Every masterpiece starts with a single note. Begin your learning journey!"
              action={{ label: 'Create First Note', onClick: onCreateNote }}
              tip="Try voice notes or AI summaries for faster capture."
            />
          ) : (
            <div className="recent-notes-scroll">
              {recentNotes.map((note) => {
                const noteCategory = categories.find(c => c.id === note.categoryId);
                return (
                  <div key={note.id} className="recent-note-card" onClick={() => onEditNote(note.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      {noteCategory && <span className="note-category-dot" style={{ background: noteCategory.color }} />}
                      <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.title}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                      {stripHtml(note.content).substring(0, 80)}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                      {note.tags.slice(0, 2).map((tag, i) => (
                        <span key={i} className="md3-chip" style={{ fontSize: '9px', padding: '2px 8px' }}>#{tag}</span>
                      ))}
                      <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--outline)' }}>
                        {formatShortDate(note.updatedAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Weekly Progress */}
        <div className="dashboard-card" style={{ flex: '1 1 35%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <BarChart3 size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Weekly Progress</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', paddingTop: '8px' }}>
            {weeklyData.map((d) => (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{
                  width: '100%', maxWidth: '28px', borderRadius: '6px 6px 2px 2px',
                  height: `${Math.max((d.count / weeklyMax) * 100, 4)}%`,
                  background: d.count > 0 ? 'linear-gradient(180deg, var(--primary-light), var(--primary))' : 'var(--outline-variant)',
                  opacity: d.count > 0 ? 1 : 0.3,
                  transition: 'height 0.5s ease',
                  minHeight: d.count > 0 ? '8px' : '4px',
                }} />
              <span style={{ fontSize: '10px', color: 'var(--outline)', fontWeight: 500, marginTop: '4px' }}>{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Search + Filters ─── */}
      <div className="search-filters-row">
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--outline)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search notes, tags, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="md3-input"
            style={{ paddingLeft: '42px', borderRadius: '100px', paddingTop: '12px', paddingBottom: '12px', fontSize: '13px' }}
          />
        </div>
        <button onClick={onCreateNote} className="md3-btn md3-btn-primary" style={{ padding: '12px 24px', fontSize: '13px', flexShrink: 0 }}>
          <Plus size={15} /> New Note
        </button>
      </div>

      {/* ════════════════════════════════════════
         SCREENSHOT SPLIT — Screenshot 1 ends here
         (Header → Hero → Stats → AI Tools → Search)
         Screenshot 2 begins below
         (Categories → Folders → Notes)
         ════════════════════════════════════════ */}
      <div className="screenshot-divider" />

      {/* ─── Categories ─── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} style={{ color: 'var(--primary)' }} /> Subjects
          </h3>
          <button onClick={() => setShowCategoryModal(true)} className="md3-btn md3-btn-text" style={{ fontSize: '12px', padding: '4px 12px' }}>
            <Plus size={14} /> Add Subject
          </button>
        </div>
        <div className="categories-scroll" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button onClick={() => setActiveCategoryId(null)}
            style={{ padding: '7px 16px', borderRadius: '100px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
              background: activeCategoryId === null ? 'var(--primary)' : 'var(--surface)', color: activeCategoryId === null ? 'var(--on-primary)' : 'var(--on-surface)',
              boxShadow: activeCategoryId === null ? '0 4px 12px rgba(0,97,164,0.3)' : 'var(--elevation-1)' }}>
            All
          </button>
          {categories.map((cat) => (
            <div key={cat.id} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
              <button onClick={() => setActiveCategoryId(cat.id)}
                style={{ padding: '7px 16px', borderRadius: '100px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  background: activeCategoryId === cat.id ? cat.color : 'var(--surface)', color: activeCategoryId === cat.id ? '#fff' : 'var(--on-surface)',
                  boxShadow: activeCategoryId === cat.id ? `0 4px 12px ${cat.color}44` : 'var(--elevation-1)' }}>
                {cat.name}
              </button>
              {!cat.id.startsWith('cat-') && (
                <button onClick={() => deleteCategory(cat.id)} style={{ position: 'absolute', top: '-4px', right: '-4px', border: 'none', background: 'var(--error)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Folders ─── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderPlus size={16} style={{ color: 'var(--primary)' }} /> Folders
          </h3>
          <button onClick={() => setShowFolderModal(true)} className="md3-btn md3-btn-text" style={{ fontSize: '12px', padding: '4px 12px' }}>
            <Plus size={14} /> New Folder
          </button>
        </div>
        <div className="folders-scroll" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button onClick={() => setActiveFolderId(null)}
            style={{ padding: '7px 16px', borderRadius: '12px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
              background: activeFolderId === null ? 'var(--primary)' : 'var(--surface)', color: activeFolderId === null ? 'var(--on-primary)' : 'var(--on-surface)',
              boxShadow: activeFolderId === null ? '0 4px 12px rgba(0,97,164,0.3)' : 'var(--elevation-1)' }}>
              📁 All Notes
            </button>
            {folders.map((folder) => (
              <div key={folder.id} style={{ display: 'inline-flex', flexShrink: 0 }}>
                <button onClick={() => setActiveFolderId(folder.id)}
                  style={{ padding: '7px 16px', borderRadius: '12px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                    background: activeFolderId === folder.id ? 'var(--primary)' : 'var(--surface)', color: activeFolderId === folder.id ? 'var(--on-primary)' : 'var(--on-surface)',
                    boxShadow: 'var(--elevation-1)' }}>
                  📁 {folder.name}
                </button>
                <button onClick={() => deleteFolder(folder.id)} style={{ border: 'none', background: 'none', padding: '4px', cursor: 'pointer', color: 'var(--error)', fontSize: '14px' }}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Notes Section ─── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} style={{ color: 'var(--primary)' }} /> Study Notes
            <span className="md3-chip" style={{ fontSize: '11px', padding: '2px 10px' }}>{displayNotes.length}</span>
          </h3>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={() => setViewMode('grid')} className="md3-btn-ghost" style={{ padding: '6px', borderRadius: '8px', color: viewMode === 'grid' ? 'var(--primary)' : 'var(--outline)' }}>
              <Grid3X3 size={16} />
            </button>
            <button onClick={() => setViewMode('list')} className="md3-btn-ghost" style={{ padding: '6px', borderRadius: '8px', color: viewMode === 'list' ? 'var(--primary)' : 'var(--outline)' }}>
              <List size={16} />
            </button>
          </div>

          {displayNotes.length === 0 ? (
            <EmptyState
              illustration={<EmptyNotesIllustration />}
              title="No Study Notes Yet"
              message="Your learning journey starts here. Create a note and watch your knowledge grow!"
              action={{ label: 'Create Note', onClick: onCreateNote }}
              tip="Organize notes with subjects, folders, and tags for easy retrieval."
            />
          ) : viewMode === 'grid' ? (
            <div className="notes-grid" style={{ gap: '16px' }}>
              {displayNotes.map((note) => {
                const noteCategory = categories.find(c => c.id === note.categoryId);
                return (
                  <div key={note.id} className="md3-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer', borderTop: noteCategory ? `4px solid ${noteCategory.color}` : '4px solid var(--outline-variant)' }}
                    onClick={() => onEditNote(note.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {note.pinLock && <Lock size={12} style={{ color: 'var(--outline)' }} />}
                        {note.title}
                      </h4>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {note.isPinned && <Pin size={13} style={{ color: 'var(--primary)', fill: 'var(--primary)' }} />}
                        {note.isFavorite && <Star size={13} style={{ color: '#F59E0B', fill: '#F59E0B' }} />}
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                      {note.pinLock ? '[🔒 Locked Note]' : stripHtml(note.content).substring(0, 150)}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 'auto' }}>
                      {noteCategory && <span className="md3-chip" style={{ fontSize: '10px', padding: '2px 10px', background: `${noteCategory.color}18`, color: noteCategory.color }}>{noteCategory.name}</span>}
                      {note.tags.slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="md3-chip" style={{ fontSize: '10px', padding: '2px 10px' }}>#{tag}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--outline-variant)', paddingTop: '10px', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--outline)' }}>{formatShortDate(note.updatedAt)}</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="md3-btn-ghost" style={{ padding: '4px', color: 'var(--error)', fontSize: '12px' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayNotes.map((note) => {
                const noteCategory = categories.find(c => c.id === note.categoryId);
                return (
                  <div key={note.id} className="md3-card-sm" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer', borderLeft: noteCategory ? `4px solid ${noteCategory.color}` : '4px solid var(--outline-variant)' }}
                    onClick={() => onEditNote(note.id)}>
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.title}</h4>
                        {note.isPinned && <Pin size={11} style={{ color: 'var(--primary)', fill: 'var(--primary)', flexShrink: 0 }} />}
                        {note.isFavorite && <Star size={11} style={{ color: '#F59E0B', fill: '#F59E0B', flexShrink: 0 }} />}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                        {stripHtml(note.content).substring(0, 100)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {noteCategory && <span className="md3-chip" style={{ fontSize: '10px', padding: '2px 10px', background: `${noteCategory.color}18`, color: noteCategory.color }}>{noteCategory.name}</span>}
                      <span style={{ fontSize: '11px', color: 'var(--outline)', whiteSpace: 'nowrap' }}>{formatShortDate(note.updatedAt)}</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="md3-btn-ghost" style={{ padding: '4px', color: 'var(--error)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Modals ─── */}
      {showFolderModal && (
        <div className="modal-backdrop" onClick={() => setShowFolderModal(false)}>
          <form className="modal-content" onClick={e => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!newFolderName.trim()) return; addFolder({ name: newFolderName.trim() }); setNewFolderName(''); setShowFolderModal(false); confetti({ particleCount: 30, spread: 40, colors: ['#0061A4'] }); }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Create Folder</h3>
            <input type="text" placeholder='e.g. Semester 2, Assignments' value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="md3-input" autoFocus required />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => setShowFolderModal(false)} className="md3-btn md3-btn-text">Cancel</button>
              <button type="submit" className="md3-btn md3-btn-primary">Create</button>
            </div>
          </form>
        </div>
      )}

      {showCategoryModal && (
        <div className="modal-backdrop" onClick={() => setShowCategoryModal(false)}>
          <form className="modal-content" onClick={e => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!newCategoryName.trim()) return; addCategory({ name: newCategoryName.trim(), color: newCategoryColor }); setNewCategoryName(''); setShowCategoryModal(false); confetti({ particleCount: 30, spread: 40, colors: [newCategoryColor] }); }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Add Subject</h3>
            <input type="text" placeholder="e.g. Computer Science" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="md3-input" autoFocus required />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              {['#0061A4', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444', '#F97316', '#14B8A6', '#84CC16', '#06B6D4', '#D946EF', '#6366F1'].map(color => (
                <button key={color} type="button" onClick={() => setNewCategoryColor(color)} style={{ width: '30px', height: '30px', borderRadius: '50%', background: color, border: newCategoryColor === color ? '2px solid var(--on-surface)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => setShowCategoryModal(false)} className="md3-btn md3-btn-text">Cancel</button>
              <button type="submit" className="md3-btn md3-btn-primary">Add</button>
            </div>
          </form>
        </div>
      )}

      {unlockNoteId && (
        <div className="modal-backdrop" onClick={() => setUnlockNoteId(null)}>
          <form className="modal-content" onClick={e => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); const target = notes.find(n => n.id === unlockNoteId); if (target && target.pinLock === pinInput) { onEditNote(unlockNoteId); setUnlockNoteId(null); } else setPinError(true); }}>
            <Lock size={36} style={{ color: 'var(--primary)', margin: '0 auto 12px', display: 'block' }} />
            <h3 style={{ fontSize: '18px', textAlign: 'center' }}>Enter PIN</h3>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', textAlign: 'center', marginBottom: '16px' }}>This note is locked</p>
            <input type="password" maxLength={4} placeholder="••••" value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} autoFocus style={{ width: '120px', margin: '0 auto', display: 'block', padding: '14px', borderRadius: '12px', border: '1.5px solid var(--outline-variant)', background: 'var(--surface)', color: 'var(--on-surface)', fontSize: '22px', letterSpacing: '10px', textAlign: 'center', outline: 'none' }} />
            {pinError && <p style={{ color: 'var(--error)', fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>Incorrect PIN</p>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
              <button type="button" onClick={() => setUnlockNoteId(null)} className="md3-btn md3-btn-text">Cancel</button>
              <button type="submit" className="md3-btn md3-btn-primary">Unlock</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
