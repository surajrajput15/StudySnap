'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, SignOutButton } from '@clerk/nextjs';
import { isSuperAdminEmail } from '@/lib/config';
import './admin.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  if (!isLoaded) {
    return (
      <div className="admin-forbidden-screen">
        <div className="admin-forbidden-card" style={{ maxWidth: '360px' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '12px' }}>🔒</div>
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>Verifying Credentials</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>
            Connecting to StudySnap Security Authority...
          </div>
        </div>
      </div>
    );
  }

  const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';
  const userRole = (user?.publicMetadata?.role as string)?.toUpperCase();
  const isSuperAdmin = isSuperAdminEmail(userEmail) || userRole === 'SUPER_ADMIN';
  const isAdmin = isSuperAdmin || userRole === 'ADMIN';

  // Strict 403 Barrier: If not signed in or not an admin/super-admin
  if (!isSignedIn || !isAdmin) {
    return (
      <div className="admin-forbidden-screen">
        <div className="admin-forbidden-card">
          <div className="admin-forbidden-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h1 className="admin-forbidden-title">403 Forbidden Access</h1>
          <p className="admin-forbidden-desc">
            The StudySnap Command Center is restricted to platform administrators and operators. Your account (<strong>{userEmail || 'Unknown'}</strong>) does not have administrative privileges.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link href="/app" className="admin-btn admin-btn-primary">
              Return to Student Workspace
            </Link>
            <SignOutButton>
              <button className="admin-btn admin-btn-outline">Sign Out</button>
            </SignOutButton>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      href: '/admin',
      label: 'Overview',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
      exact: true,
    },
    {
      href: '/admin/users',
      label: 'User Directory',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
    },
    {
      href: '/admin/ai',
      label: 'AI Operations',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
        </svg>
      ),
    },
    {
      href: '/admin/system',
      label: 'System Health',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      ),
    },
    {
      href: '/admin/audit',
      label: 'Audit Trail',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      ),
    },
  ];

  const envName = process.env.NODE_ENV === 'production' ? 'Production' : 'Development';

  return (
    <div className="admin-layout-container">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="admin-sidebar-header">
          <Link href="/admin" className="admin-brand" onClick={() => setMobileMenuOpen(false)}>
            <div className="admin-brand-icon">⚡</div>
            <div>
              <div className="admin-brand-title">StudySnap</div>
              <div className="admin-brand-subtitle">Command Center</div>
            </div>
          </Link>
          <div className="admin-badge-super">
            <span>🛡️</span>
            <span>{isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN'}</span>
          </div>
        </div>

        <nav className="admin-nav">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <Link href="/app" className="admin-switch-btn" title="Open Student Workspace">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <span>Student Workspace</span>
          </Link>
          <div className="admin-user-pill" title={userEmail}>
            👤 {userEmail}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="admin-main">
        <header className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="admin-mobile-toggle"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div className="admin-header-title">
              {pathname === '/admin' && 'Platform Overview'}
              {pathname.startsWith('/admin/users') && 'User Directory & Moderation'}
              {pathname.startsWith('/admin/ai') && 'AI Operations & Telemetry'}
              {pathname.startsWith('/admin/system') && 'Infrastructure & System Probes'}
              {pathname.startsWith('/admin/audit') && 'Security & Audit Logs'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: '6px',
                background: envName === 'Production' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: envName === 'Production' ? '#059669' : '#2563eb',
                fontWeight: 600,
                border: `1px solid ${envName === 'Production' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
              }}
            >
              Environment: {envName}
            </span>
          </div>
        </header>

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
