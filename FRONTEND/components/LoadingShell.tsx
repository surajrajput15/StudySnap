'use client';

import React from 'react';

// Day 9 Task 14 — SSR/loading shell. The old page returned null until the
// client mounted, so the first paint was a blank screen. This skeleton renders
// during the pre-mount window (and server-side) so the app never shows nothing:
// it mirrors the app's chrome (sidebar, header, content grid) using theme-aware
// CSS variables, preventing both the blank flash and layout shift on hydration.
export default function LoadingShell() {
  return (
    <div className="app-loading-shell" role="status" aria-label="Loading StudySnap">
      <aside className="loading-sidebar" aria-hidden="true">
        <div className="loading-brand" />
        <div className="loading-nav-pill" style={{ width: '82%' }} />
        <div className="loading-nav-pill" style={{ width: '64%' }} />
        <div className="loading-nav-pill" style={{ width: '74%' }} />
        <div className="loading-nav-pill" style={{ width: '58%' }} />
      </aside>
      <div className="loading-main">
        <div className="loading-header" aria-hidden="true">
          <div className="loading-title" />
        </div>
        <div className="loading-body" aria-hidden="true">
          <div className="loading-block block-lg" />
          <div className="loading-block block-md" />
          <div className="loading-block block-sm" />
          <div className="loading-block block-md" />
          <div className="loading-block block-sm" />
          <div className="loading-block block-lg" />
        </div>
      </div>
    </div>
  );
}