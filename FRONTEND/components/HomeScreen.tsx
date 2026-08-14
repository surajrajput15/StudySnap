'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useStore, type Folder } from '@/lib/store/useStore';
import {
  Sparkles, BookOpen, FileText, Clock,
  Target, ChevronRight, Play, BarChart3,
  CheckCircle2, Flame, Plus, Search, Star, Pin,
  Layers, FolderPlus, Grid3X3, List, Lock, ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import EmptyState, { EmptyNotesIllustration, EmptySearchIllustration } from './EmptyState';
import HeroAI from './HeroAI';
import { NoteCard, NoteListItem } from './NoteCards';
import { WEEKDAYS, DAILY_GOAL, AI_TOOLS } from '@/lib/constants';
import { formatShortDate, stripHtml, hasActiveSearch, noteMatchesSearch, SEARCH_EMPTY_MESSAGE, SEARCH_EMPTY_TIP, handleCardKeyDown } from '@/lib/utils';
import { pinMatchesStored } from '@/lib/pin';
import { deleteRemoteNote, deleteFolderWithNotes } from '@/lib/sync/notesSync';
import { deferDelete, cancelPendingDeleteFor } from '@/lib/undo';
import { useAuth } from '@clerk/nextjs';
import { useDialogFocus } from '@/lib/useDialogFocus';

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
  const { getToken } = useAuth();
  const user = useStore((s) => s.user);
  const notes = useStore((s) => s.notes);
  const categories = useStore((s) => s.categories);
  const folders = useStore((s) => s.folders);
  const activeFolderId = useStore((s) => s.activeFolderId);
  const activeCategoryId = useStore((s) => s.activeCategoryId);
  const searchQuery = useStore((s) => s.searchQuery);
  const addFolder = useStore((s) => s.addFolder);
  const addCategory = useStore((s) => s.addCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const setActiveFolderId = useStore((s) => s.setActiveFolderId);
  const setActiveCategoryId = useStore((s) => s.setActiveCategoryId);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const deleteNote = useStore((s) => s.deleteNote);
  const markAsRevised = useStore((s) => s.markAsRevised);
  const setActiveAiTool = useStore((s) => s.setActiveAiTool);
  const storedDailyProgress = useStore((s) => s.dailyProgress);
  const checkAndResetDaily = useStore((s) => s.checkAndResetDaily);

  useEffect(() => {
    // Bump across midnight (store counters track a per-day window already).
    checkAndResetDaily();
  }, [checkAndResetDaily]);

  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#0061A4');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Day 9 Task 3 — folder deletion is destructive (it permanently deletes the
  // notes inside). We never delete on first click: a confirmation modal opens,
  // and only its confirm button performs the deletion.
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [unlockNoteId, setUnlockNoteId] = useState<string | null>(null);
  const [pinError, setPinError] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Day 12 Tasks 2 & 4 — the dashboard dialogs share one focus/escape handler.
  // Only one dialog is open at a time, so a single ref on the currently-mounted
  // backdrop drives the trap; focus returns to the trigger on close.
  const modalRef = useRef<HTMLDivElement | null>(null);
  const anyModalOpen = showFolderModal || showCategoryModal || !!folderToDelete || !!unlockNoteId;
  const closeAllModals = () => {
    setShowFolderModal(false);
    setShowCategoryModal(false);
    setFolderToDelete(null);
    setUnlockNoteId(null);
  };
  useDialogFocus(anyModalOpen, modalRef, closeAllModals);
  const filteredNotes = useMemo(() => notes.filter((note) => {
    const matchesSearch = noteMatchesSearch(searchQuery, note);
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

  // Now-day activity comes from the store's counter (incrementing on note
  // creation, revisions, and voice notes) so the goal reflects real study
  // actions instead of object timestamps.
  const dailyProgress = Math.min(storedDailyProgress, DAILY_GOAL);

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

  // Day 9 Task 13 — the streak is display-only. It grows exclusively through
  // real study activity (creating notes, recording voice notes, completing
  // revisions); clicking the counter must never increment it.

  // Day 9 Task 9 — a single-click note delete is deferred so a mistaken tap can
  // be undone. The real deletion (local removal + tombstone + remote DELETE)
  // runs only after the undo window expires.
  // Day 11 Task 2 — the note cards are React.memo'd, which only pays off when
  // the handlers passed down have stable identities. The live notes snapshot is
  // therefore read through a ref (refs never invalidate a useCallback) instead
  // of the `notes` value directly.
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const handleDeleteNote = useCallback((noteId: string) => {
    const target = notesRef.current.find(n => n.id === noteId);
    const label = `Note "${target?.title?.trim() || 'Untitled'}" deleted`;
    deferDelete(label, () => {
      deleteNote(noteId);
      void deleteRemoteNote(noteId, () => getToken());
    }, undefined, noteId);
  }, [deleteNote, getToken]);

  // Day 9 Task 3 — open the confirmation dialog. Nothing is deleted here.
  const handleDeleteFolder = (folder: Folder) => {
    setFolderToDelete(folder);
  };

  // Confirm button: perform the destructive cascade using the safe per-note
  // deletion path (local removal + tombstone + remote DELETE) so the affected
  // notes can never resurrect from the server on the next sync.
  const confirmDeleteFolder = () => {
    if (!folderToDelete) return;
    const folder = folderToDelete;
    setFolderToDelete(null);
    deleteFolderWithNotes(folder.id, () => getToken());
  };

  const cancelDeleteFolder = () => {
    setFolderToDelete(null);
  };

  // Central gate for opening a note: locked notes first ask for their PIN
  // (the hash is verified before the editor is opened), unlocked notes open
  // directly.
  const openNote = useCallback((id: string) => {
    // Day 10 Task 1 — a note inside its delete-undo window is still listed and
    // clickable. Opening it cancels that pending delete: the user clearly wants
    // the note, and letting the deferred delete fire mid-edit silently loses
    // their work (the editor's autosave finds no note and no-ops).
    cancelPendingDeleteFor(id);
    const target = notesRef.current.find(n => n.id === id);
    if (target?.pinLock) {
      setPinInput('');
      setPinError(false);
      setUnlockNoteId(id);
    } else {
      onEditNote(id);
    }
  }, [onEditNote]);

  const handleUnlockSubmit = async () => {
    if (!unlockNoteId || isUnlocking) return;
    const target = notes.find(n => n.id === unlockNoteId);
    if (!target) { setUnlockNoteId(null); return; }
    setIsUnlocking(true);
    const ok = await pinMatchesStored(pinInput, target.pinLock);
    setIsUnlocking(false);
    if (ok) {
      onEditNote(unlockNoteId);
      setUnlockNoteId(null);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
    }
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
              <div className="streak-btn" title="Grows when you create notes, record voice notes, or complete revisions.">
                <Flame size={22} color="#FBBF24" fill="#FBBF24" />
                <div>
                  <div className="streak-count">{user.streakCount}</div>
                  <div className="streak-label">day streak</div>
                </div>
              </div>
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
                <div className="hero-continue-body" role="button" tabIndex={0} onClick={() => openNote(lastEditedNote.id)} onKeyDown={(e) => handleCardKeyDown(e, () => openNote(lastEditedNote.id))}>
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
                <div className="hero-continue-empty" role="button" tabIndex={0} onClick={onCreateNote} onKeyDown={(e) => handleCardKeyDown(e, onCreateNote)}>
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
                    <div key={note.id} className="hero-revision-item" role="button" tabIndex={0} onClick={() => openNote(note.id)} onKeyDown={(e) => handleCardKeyDown(e, () => openNote(note.id))}>
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
                    <div className="hero-revision-more" role="button" tabIndex={0} onClick={() => onNavigate('calendar')} onKeyDown={(e) => handleCardKeyDown(e, () => onNavigate('calendar'))}>
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
          <div className="stat-icon" style={{ background: 'rgba(0, 97, 164, 0.12)' }}>
            <FileText size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <div className="stat-value">{totalNotes}</div>
            <div className="stat-label">Total Notes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
            <CheckCircle2 size={18} style={{ color: '#10B981' }} />
          </div>
          <div>
            <div className="stat-value">{totalRevised}</div>
            <div className="stat-label">Revised</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)' }}>
            <Pin size={18} style={{ color: '#F59E0B' }} />
          </div>
          <div>
            <div className="stat-value">{totalPinned}</div>
            <div className="stat-label">Pinned</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(236, 72, 153, 0.12)' }}>
            <Star size={18} style={{ color: '#EC4899' }} />
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
                  <div key={note.id} className="recent-note-card" role="button" tabIndex={0} onClick={() => openNote(note.id)} onKeyDown={(e) => handleCardKeyDown(e, () => openNote(note.id))}>
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
            style={{ paddingLeft: '42px', borderRadius: '100px', paddingTop: '12px', paddingBottom: '12px', fontSize: '16px' }}
          />
        </div>
        <button onClick={onCreateNote} className="md3-btn md3-btn-primary" style={{ padding: '12px 24px', fontSize: '13px', flexShrink: 0 }}>
          <Plus size={15} /> New Note
        </button>
      </div>

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
        <div className="categories-scroll">
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
                <button onClick={() => deleteCategory(cat.id)} aria-label={`Delete category ${cat.name}`} style={{ position: 'absolute', top: '-4px', right: '-4px', border: 'none', background: 'var(--error)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
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
        <div className="folders-scroll">
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
                <button onClick={() => handleDeleteFolder(folder)} aria-label={`Delete folder ${folder.name}`} style={{ border: 'none', background: 'none', padding: '4px', cursor: 'pointer', color: 'var(--error)', fontSize: '14px' }}>×</button>
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
            <button onClick={() => setViewMode('grid')} className="md3-btn-ghost" style={{ padding: '6px', borderRadius: '8px', color: viewMode === 'grid' ? 'var(--primary)' : 'var(--outline)' }} aria-label="Grid view" aria-pressed={viewMode === 'grid'}>
              <Grid3X3 size={16} />
            </button>
            <button onClick={() => setViewMode('list')} className="md3-btn-ghost" style={{ padding: '6px', borderRadius: '8px', color: viewMode === 'list' ? 'var(--primary)' : 'var(--outline)' }} aria-label="List view" aria-pressed={viewMode === 'list'}>
              <List size={16} />
            </button>
          </div>

          {displayNotes.length === 0 ? (
            hasActiveSearch(searchQuery) ? (
              <EmptyState
                illustration={<EmptySearchIllustration />}
                title={`No results for "${searchQuery.trim()}"`}
                message={SEARCH_EMPTY_MESSAGE}
                action={{ label: 'Clear Search', onClick: () => setSearchQuery('') }}
                tip={SEARCH_EMPTY_TIP}
              />
            ) : (
              <EmptyState
                illustration={<EmptyNotesIllustration />}
                title="No Study Notes Yet"
                message="Your learning journey starts here. Create a note and watch your knowledge grow!"
                action={{ label: 'Create Note', onClick: onCreateNote }}
                tip="Organize notes with subjects, folders, and tags for easy retrieval."
              />
            )
          ) : viewMode === 'grid' ? (
            <div className="notes-grid" style={{ gap: '16px' }}>
              {displayNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  category={categories.find(c => c.id === note.categoryId)}
                  onOpen={openNote}
                  onDelete={handleDeleteNote}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayNotes.map((note) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  category={categories.find(c => c.id === note.categoryId)}
                  onOpen={openNote}
                  onDelete={handleDeleteNote}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Modals ─── */}
      {showFolderModal && (
        <div ref={modalRef} className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="folder-modal-title" onClick={() => setShowFolderModal(false)}>
          <form className="modal-content" onClick={e => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!newFolderName.trim()) return; addFolder({ name: newFolderName.trim() }); setNewFolderName(''); setShowFolderModal(false); confetti({ particleCount: 30, spread: 40, colors: ['#0061A4'] }); }}>
            <h3 id="folder-modal-title" style={{ fontSize: '18px', marginBottom: '16px' }}>Create Folder</h3>
            <input type="text" placeholder='e.g. Semester 2, Assignments' value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="md3-input" autoFocus required />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => setShowFolderModal(false)} className="md3-btn md3-btn-text">Cancel</button>
              <button type="submit" className="md3-btn md3-btn-primary">Create</button>
            </div>
          </form>
        </div>
      )}

      {showCategoryModal && (
        <div ref={modalRef} className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="category-modal-title" onClick={() => setShowCategoryModal(false)}>
          <form className="modal-content" onClick={e => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!newCategoryName.trim()) return; addCategory({ name: newCategoryName.trim(), color: newCategoryColor }); setNewCategoryName(''); setShowCategoryModal(false); confetti({ particleCount: 30, spread: 40, colors: [newCategoryColor] }); }}>
            <h3 id="category-modal-title" style={{ fontSize: '18px', marginBottom: '16px' }}>Add Subject</h3>
            <input type="text" placeholder="e.g. Computer Science" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="md3-input" autoFocus required />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              {['#0061A4', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444', '#F97316', '#14B8A6', '#84CC16', '#06B6D4', '#D946EF', '#6366F1'].map(color => (
                <button key={color} type="button" onClick={() => setNewCategoryColor(color)} aria-label={`Select color ${color}`} aria-pressed={newCategoryColor === color} style={{ width: '30px', height: '30px', borderRadius: '50%', background: color, border: newCategoryColor === color ? '2px solid var(--on-surface)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => setShowCategoryModal(false)} className="md3-btn md3-btn-text">Cancel</button>
              <button type="submit" className="md3-btn md3-btn-primary">Add</button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Folder delete confirmation ─── */}
      {folderToDelete && (
        <div ref={modalRef} className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="folder-delete-title" onClick={cancelDeleteFolder}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 id="folder-delete-title" style={{ fontSize: '18px', marginBottom: '12px' }}>Delete folder?</h3>
            {(() => {
              const count = notes.filter((n) => n.folderId === folderToDelete.id).length;
              return count > 0 ? (
                <p style={{ fontSize: '14px', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
                  <strong>&quot;{folderToDelete.name}&quot;</strong> contains {count} note{count === 1 ? '' : 's'}. Deleting this folder
                  permanently deletes {count === 1 ? 'it' : 'them'} too. This cannot be undone.
                </p>
              ) : (
                <p style={{ fontSize: '14px', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
                  Delete folder <strong>&quot;{folderToDelete.name}&quot;</strong>?
                </p>
              );
            })()}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={cancelDeleteFolder} className="md3-btn md3-btn-text">Cancel</button>
              <button type="button" onClick={confirmDeleteFolder} className="md3-btn md3-btn-primary" style={{ background: 'var(--error)', borderColor: 'var(--error)' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {unlockNoteId && (
        <div ref={modalRef} className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="unlock-modal-title" onClick={() => setUnlockNoteId(null)}>
          <form className="modal-content" onClick={e => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void handleUnlockSubmit(); }}>
            <Lock size={36} style={{ color: 'var(--primary)', margin: '0 auto 12px', display: 'block' }} />
            <h3 id="unlock-modal-title" style={{ fontSize: '18px', textAlign: 'center' }}>Enter PIN</h3>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', textAlign: 'center', marginBottom: '16px' }}>This note is locked</p>
            <input type="password" maxLength={4} placeholder="••••" value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} autoFocus disabled={isUnlocking} style={{ width: '120px', margin: '0 auto', display: 'block', padding: '14px', borderRadius: '12px', border: '1.5px solid var(--outline-variant)', background: 'var(--surface)', color: 'var(--on-surface)', fontSize: '22px', letterSpacing: '10px', textAlign: 'center', outline: 'none' }} />
            {pinError && <p style={{ color: 'var(--error)', fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>Incorrect PIN</p>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
              <button type="button" onClick={() => setUnlockNoteId(null)} className="md3-btn md3-btn-text" disabled={isUnlocking}>Cancel</button>
              <button type="submit" className="md3-btn md3-btn-primary" disabled={isUnlocking || pinInput.length !== 4}>
                {isUnlocking ? 'Checking...' : 'Unlock'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
