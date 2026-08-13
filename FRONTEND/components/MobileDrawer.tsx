'use client';

import React, { useEffect, useRef } from 'react';
import {
  Home, FileText, Mic, Sparkles, Calendar,
  Trophy, User, LogOut, LogIn, X
} from 'lucide-react';
import { SignInButton, useAuth, useUser, useClerk } from '@clerk/nextjs';
import Image from 'next/image';
import { useStore, switchStoreScopeForUser } from '@/lib/store/useStore';
import { isValidAppTab } from '@/lib/utils';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  activeTab: string;
  onNavigate: (tab: string) => void;
}

// Day 9 Task 8 — every item here must map to a real, rendered tab (validated
// at render time via isValidAppTab). The old Folders/Favorites/Statistics/
// Settings/About entries had no real view — they collapsed onto home/profile —
// so they were dead items; Achievements and Profile were missing entirely.
const DRAWER_ITEMS = [
  { id: 'home', label: 'Dashboard', icon: Home },
  { id: 'editor', label: 'Notes', icon: FileText },
  { id: 'voice', label: 'Voice Notes', icon: Mic },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles },
  { id: 'calendar', label: 'Revision', icon: Calendar },
  { id: 'gamification', label: 'Achievements', icon: Trophy },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function MobileDrawer({ open, onClose, activeTab, onNavigate }: MobileDrawerProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const syncProfileNameFromClerk = useStore((s) => s.syncProfileNameFromClerk);
  const drawerRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // Only adopt the Clerk display name when the profile still has its default
    // placeholder, so a custom name the user set is never overwritten.
    if (user?.fullName) {
      syncProfileNameFromClerk(user.fullName);
    }
  }, [user, syncProfileNameFromClerk]);

  useEffect(() => {
    if (!open) {
      return;
    }
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const drawer = drawerRef.current;
    const focusables = () => {
      if (!drawer) return [];
      return Array.from(drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      ));
    };
    const focusFirst = () => {
      const els = focusables();
      els[0]?.focus();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey) {
        if (active === first || !drawer?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !drawer?.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    focusFirst();
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      lastFocusedRef.current?.focus();
    };
  }, [open, onClose]);

  const handleNav = (id: string) => {
    onNavigate(id);
    onClose();
  };

  const userDisplayName = user?.fullName || 'Student';
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
  const userImage = user?.imageUrl;

  return (
    <>
      <div
        className={`drawer-overlay ${open ? 'drawer-overlay--open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        id="mobile-menu"
        className={`drawer ${open ? 'drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="drawer-header">
          <div className="drawer-header-top">
            <Image src="/window.svg" alt="StudySnap" className="drawer-logo" width={512} height={512} unoptimized />
            <button className="drawer-close" onClick={onClose} aria-label="Close menu">
              <X size={20} />
            </button>
          </div>
          <div id="drawer-title" className="drawer-tagline">Study Smarter. Score Better.</div>

          {isLoaded && isSignedIn ? (
            <div className="drawer-user">
              <div className="drawer-avatar">
                {userImage ? (
                  <Image src={userImage} alt="Your profile avatar" className="drawer-avatar-img" width={44} height={44} unoptimized />
                ) : (
                  <span className="drawer-avatar-fallback">{userDisplayName[0]}</span>
                )}
              </div>
              <div className="drawer-user-info">
                <div className="drawer-user-name">{userDisplayName}</div>
                {userEmail && <div className="drawer-user-email">{userEmail}</div>}
              </div>
            </div>
          ) : (
            <div className="drawer-signin-section">
              <SignInButton mode="modal" forceRedirectUrl="/" signUpForceRedirectUrl="/">
                <button className="drawer-signin-btn">
                  <LogIn size={18} />
                  Sign In
                </button>
              </SignInButton>
              <div className="drawer-signin-hint">
                Sync your notes across devices using your account.
              </div>
            </div>
          )}
        </div>

        <nav className="drawer-nav">
          {DRAWER_ITEMS.filter((item) => isValidAppTab(item.id)).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`drawer-item ${isActive ? 'drawer-item--active' : ''}`}
                onClick={() => handleNav(item.id)}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="drawer-item-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="drawer-footer">
          {isSignedIn ? (
            <button className="drawer-item drawer-item--danger" onClick={() => { onClose(); switchStoreScopeForUser(null); signOut(); }}>
              <LogOut size={20} />
              <span className="drawer-item-label">Logout</span>
            </button>
          ) : (
            <SignInButton mode="modal" forceRedirectUrl="/" signUpForceRedirectUrl="/">
              <button className="drawer-item drawer-item--signin" onClick={onClose}>
                <LogIn size={20} />
                <span className="drawer-item-label">Sign In</span>
              </button>
            </SignInButton>
          )}
        </div>
      </div>
    </>
  );
}
