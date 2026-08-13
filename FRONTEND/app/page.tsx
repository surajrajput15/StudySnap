'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useStore, switchStoreScopeForUser } from '@/lib/store/useStore';
import { syncNotesForUser } from '@/lib/sync/notesSync';
import { syncVoiceNotesForUser } from '@/lib/sync/voiceNotesSync';
import {
  createSyncEngine,
  SyncThrottledError,
  type SyncChildStatusEvent,
  type SyncEngine,
} from '@/lib/sync/syncEngine';
import HomeScreen from '@/components/HomeScreen';
import MobileDrawer from '@/components/MobileDrawer';
import OfflineBanner from '@/components/OfflineBanner';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import { RECORDING_NAV_CONFIRM_MESSAGE, shouldConfirmRecordingNav } from '@/lib/utils';

const NoteEditor = dynamic(() => import('@/components/NoteEditor'), { ssr: false });
const VoiceNotes = dynamic(() => import('@/components/VoiceNotes'), { ssr: false });
const AiTutor = dynamic(() => import('@/components/AiTutor'), { ssr: false });
const RevisionCalendar = dynamic(() => import('@/components/RevisionCalendar'), { ssr: false });
const ProfileView = dynamic(() => import('@/components/ProfileView'), { ssr: false });
const GamificationHub = dynamic(() => import('@/components/GamificationHub'), { ssr: false });
import { 
  Home, FileText, Mic, Calendar, Sparkles, User, Sun, Moon, 
  LogIn, ChevronRight, Trophy, Menu
} from 'lucide-react';
import { SignInButton, UserButton, useAuth, useUser } from '@clerk/nextjs';
import Image from 'next/image';

export default function Page() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const activeNoteId = useStore((s) => s.activeNoteId);
  const setActiveNoteId = useStore((s) => s.setActiveNoteId);
  const syncProfileNameFromClerk = useStore((s) => s.syncProfileNameFromClerk);
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'home';
    const params = new URLSearchParams(window.location.search);
    return params.get('returnTo') === 'ai' ? 'ai' : 'home';
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Day 9 Task 4 — mirrors VoiceNotes' isRecording so navigation can guard
  // against silently discarding an active recording.
  const [voiceRecording, setVoiceRecording] = useState(false);

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Day 9 Task 4 — the single navigation chokepoint. Every in-app tab switch
  // goes through here so leaving the voice tab while recording asks first
  // instead of silently discarding the recording on unmount. Cancel keeps the
  // recording alive; confirm navigates (VoiceNotes' own unmount cleanup then
  // discards the uncommitted recording). The VoiceNotes back button keeps its
  // self-guard and calls setActiveTab directly to avoid a double confirmation.
  const navigate = (nextTab: string) => {
    if (shouldConfirmRecordingNav(activeTab, nextTab, voiceRecording)) {
      const leave = window.confirm(RECORDING_NAV_CONFIRM_MESSAGE);
      if (!leave) return;
    }
    setActiveTab(nextTab);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('returnTo') === 'ai') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const clerkId = clerkUser?.id ?? null;

  // Isolate persisted data per account: whenever the signed-in user changes,
  // atomically swap the store to that user's scoped localStorage key BEFORE the
  // DOM paints, so a previous account's notes can never flash on screen.
  useLayoutEffect(() => {
    if (!isLoaded) return;
    switchStoreScopeForUser(isSignedIn ? clerkId : null);
  }, [isLoaded, isSignedIn, clerkId]);

  useEffect(() => {
    // Adopt the Clerk display name only while a profile has no custom name yet
    // (the sync action itself is idempotent). Never reset to "Student".
    if (isLoaded && isSignedIn && clerkUser?.fullName) {
      syncProfileNameFromClerk(clerkUser.fullName);
    }
  }, [isLoaded, isSignedIn, clerkUser, syncProfileNameFromClerk]);

  // Day 8 Task 3 (Phases A+B) — single-flight sync engine + observability.
  // The engine owns WHEN sync runs (mount, reconnect, visibility, manual retry)
  // and single-flights the notes + voice-note hydration passes, which are the
  // injected `runTasks`. A 429 reported by either layer surfaces as a
  // SyncThrottledError so the engine honors Retry-After. `syncStatus` is written
  // into the ephemeral store slice for the SyncStatusIndicator.
  const engineRef = useRef<SyncEngine | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !clerkId) {
      engineRef.current?.stop();
      engineRef.current = null;
      useStore.getState().setSyncStatus(null);
      return;
    }

    const engine = createSyncEngine(`studysnap:sync:${clerkId}`, {
      runTasks: () => {
        let throttled: SyncThrottledError | null = null;
        const report: (event: SyncChildStatusEvent) => void = (event) => {
          if (event.type === 'rateLimited') {
            throttled = new SyncThrottledError(event.status, event.retryAfterMs);
          }
        };
        return Promise.all([
          syncNotesForUser(clerkId, () => getToken(), { onStatus: report }),
          syncVoiceNotesForUser(clerkId, () => getToken(), { onStatus: report }),
        ]).then(() => {
          // A 429 in either layer makes this whole run back off per Retry-After.
          if (throttled) throw throttled;
        });
      },
      onStatus: (status) => useStore.getState().setSyncStatus(status),
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
      engineRef.current = null;
      useStore.getState().setSyncStatus(null);
    };
  }, [isLoaded, isSignedIn, clerkId, getToken]);

  const handleEditNote = (noteId: string) => {
    setActiveNoteId(noteId);
    navigate('editor');
  };

  const handleCreateNote = () => {
    setActiveNoteId(null);
    navigate('editor');
  };

  const handleLinkToNote = (noteId: string) => {
    setActiveNoteId(noteId);
    navigate('editor');
  };

  // Day 9 Task 8 — the mobile drawer only contains real, rendered tabs now, so
  // navigation is a direct tab switch through the guarded chokepoint (the old
  // folders/favorites/statistics/settings/about alias routing is gone).
  const handleDrawerNav = (tab: string) => {
    navigate(tab);
  };

  const navItems = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'editor', label: 'Note Editor', icon: FileText },
    { id: 'voice', label: 'Voice Notes', icon: Mic },
    { id: 'calendar', label: 'Revision', icon: Calendar },
    { id: 'ai', label: 'AI Assistant', icon: Sparkles },
    { id: 'gamification', label: 'Achievements', icon: Trophy },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  if (!mounted) return null;

  return (
    <div className="app-root">
      <OfflineBanner />

      {/* ─── Mobile Drawer ─── */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeTab={activeTab}
        onNavigate={handleDrawerNav}
      />

      {/* ─── Desktop Sidebar ─── */}
      <aside className="app-sidebar">
        <div className="sidebar-brand" role="button" tabIndex={0} onClick={() => navigate('home')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('home'); } }}>
          <Image src="/window.svg" alt="" className="sidebar-logo" width={512} height={512} unoptimized />
          <span className="sidebar-name">StudySnap</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => navigate(tab.id)}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
                <span>{tab.label}</span>
                {isActive && <ChevronRight size={14} className="sidebar-chevron" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-version">StudySnap v0.1</span>
        </div>
      </aside>

      {/* ─── Tablet Mini Sidebar ─── */}
      <aside className="app-rail">
        {navItems.slice(0, 6).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`rail-link ${isActive ? 'active' : ''}`}
              onClick={() => navigate(tab.id)}
              title={tab.label}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
            </button>
          );
        })}
      </aside>

      {/* ─── Header ─── */}
      <header className="app-header">
        <div className="header-inner">
          <div className="header-left">
            <button className="header-hamburger" onClick={() => setDrawerOpen(true)} aria-label="Open menu" aria-expanded={drawerOpen} aria-controls="mobile-menu">
              <Menu size={22} />
            </button>
            <span className="header-title" role="button" tabIndex={0} onClick={() => navigate('home')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('home'); } }}>
              <Image src="/window.svg" alt="" className="header-mobile-logo" width={512} height={512} unoptimized />
              <span className="header-brand-text">StudySnap</span>
              <span className="header-tab-name">{navItems.find(t => t.id === activeTab)?.label}</span>
            </span>
          </div>
          <div className="header-right">
            <SyncStatusIndicator onRetry={() => engineRef.current?.requestSync()} />
            <button onClick={toggleTheme} className="header-icon-btn" aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            {isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal" forceRedirectUrl="/" signUpForceRedirectUrl="/">
                <button className="header-signin">
                  <LogIn size={14} /> <span>Sign In</span>
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="app-main">
        <h1 className="visually-hidden">{navItems.find(t => t.id === activeTab)?.label || 'StudySnap'}</h1>
        <div className="main-content">
          {activeTab === 'home' && (
            <HomeScreen 
              onEditNote={handleEditNote} 
              onCreateNote={handleCreateNote} 
              onNavigate={(tab) => navigate(tab)}
            />
          )}
          {activeTab === 'editor' && (
            <NoteEditor 
              noteId={activeNoteId} 
              onBack={() => navigate('home')}
            />
          )}
          {activeTab === 'voice' && (
            <VoiceNotes 
              onBack={() => setActiveTab('home')}
              onLinkToNote={handleLinkToNote}
              onRecordingChange={setVoiceRecording}
            />
          )}
          {activeTab === 'calendar' && <RevisionCalendar />}
          {activeTab === 'ai' && <AiTutor onBack={() => navigate('home')} />}
          {activeTab === 'gamification' && <GamificationHub />}
          {activeTab === 'profile' && <ProfileView />}
        </div>
      </main>

      {/* ─── Mobile Bottom Nav ─── */}
      <nav className="app-bottom-nav">
        {navItems.slice(0, 5).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`bottom-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => navigate(tab.id)}
            >
              <div className="bottom-nav-icon-wrap">
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              </div>
              <span className="bottom-nav-label">{tab.label}</span>
            </button>
          );
        })}
        <button
          className={`bottom-nav-link ${activeTab === 'gamification' || activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => navigate(activeTab === 'gamification' || activeTab === 'profile' ? activeTab : 'profile')}
        >
          <div className="bottom-nav-icon-wrap">
            <User size={20} />
          </div>
          <span className="bottom-nav-label">More</span>
        </button>
      </nav>
    </div>
  );
}
