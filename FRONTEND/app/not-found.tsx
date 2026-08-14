import React from 'react';
import Link from 'next/link';

// Day 15 Task 1 — friendly 404 for any unknown route (single-route app, so this
// mostly guards deep links / stale bookmarks).
export default function NotFound() {
  return (
    <div className="not-found" role="alert">
      <div className="not-found-inner">
        <p className="not-found-code">404</p>
        <h1 className="not-found-title">This page went offline</h1>
        <p className="not-found-copy">The page you are looking for does not exist.</p>
        <Link href="/" className="error-boundary-action">
          Back to StudySnap
        </Link>
      </div>
    </div>
  );
}