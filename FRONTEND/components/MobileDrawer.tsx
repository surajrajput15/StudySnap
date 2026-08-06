'use client';

import React, { useEffect, useRef } from 'react';
import {
  Home, FileText, Mic, Sparkles, Calendar, Folder, Star,
  BarChart3, Settings, Info, LogOut, LogIn, X
} from 'lucide-react';
import { SignInButton, useAuth, useUser, useClerk } from '@clerk/nextjs';
import { useStore } from '@/lib/store/useStore';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  activeTab: string;
  onNavigate: (tab: string) => void;
}

const DRAWER_ITEMS = [
  { id: 'home', label: 'Dashboard', icon: Home },
  { id: 'editor', label: 'Notes', icon: FileText },
  { id: 'voice', label: 'Voice Notes', icon: Mic },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles },
  { id: 'calendar', label: 'Revision', icon: Calendar },
  { id: 'folders', label: 'Folders', icon: Folder },
  { id: 'favorites', label: 'Favorites', icon: Star },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'about', label: 'About', icon: Info },
];

export default function MobileDrawer({ open, onClose, activeTab, onNavigate }: MobileDrawerProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { updateProfile } = useStore();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.fullName) {
      updateProfile({ name: user.fullName });
    }
  }, [user, updateProfile]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
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
        className={`drawer ${open ? 'drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="drawer-header">
          <div className="drawer-header-top">
            <img src="/window.svg" alt="StudySnap" className="drawer-logo" />
            <button className="drawer-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <div className="drawer-tagline">Study Smarter. Score Better.</div>

          {isLoaded && isSignedIn ? (
            <div className="drawer-user">
              <div className="drawer-avatar">
                {userImage ? (
                  <img src={userImage} alt="avatar" className="drawer-avatar-img" />
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
          {DRAWER_ITEMS.map((item) => {
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
            <button className="drawer-item drawer-item--danger" onClick={() => { onClose(); signOut(); }}>
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
