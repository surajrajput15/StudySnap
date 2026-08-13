export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export function dateKey(date: Date | string = new Date()): string {
  const value = date instanceof Date ? date : new Date(date);
  return value.toISOString().split('T')[0];
}

export function formatShortDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Day 9 Task 4 — message shared by every navigation guard that would discard
// an active voice recording. Kept in one place so the VoiceNotes back button
// and the app-level navigation guard always present the same copy.
export const RECORDING_NAV_CONFIRM_MESSAGE = 'You are still recording. Leave and discard this recording?';

// Day 9 Task 4 — true when navigating away from the voice tab would silently
// discard an active recording, so the caller must confirm first. Re-selecting
// the voice tab itself (nextTab === 'voice') never needs confirmation.
export function shouldConfirmRecordingNav(currentTab: string, nextTab: string, recording: boolean): boolean {
  return recording && currentTab === 'voice' && nextTab !== 'voice';
}

// Day 9 Task 6 — true when a search query is actually active (non-empty after
// trimming). Guards whether the "no results" empty state is shown instead of
// the generic first-run "no notes yet" state.
export function hasActiveSearch(query: string): boolean {
  return query.trim().length > 0;
}

// Day 9 Task 6 — search semantics for a note: a blank query matches everything
// (no filtering); otherwise the title, content or any tag must contain the
// (case-insensitive) query.
export function noteMatchesSearch(query: string, note: { title: string; content: string; tags: string[] }): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    note.title.toLowerCase().includes(q) ||
    note.content.toLowerCase().includes(q) ||
    note.tags.some((t) => t.toLowerCase().includes(q))
  );
}

// Day 9 Task 6 — copy for the search-specific empty state (shown only when a
// search is active but no note matches).
export const SEARCH_EMPTY_MESSAGE = 'Try different keywords, or clear the search to see all your notes.';
export const SEARCH_EMPTY_TIP = 'Search matches titles, content, and tags.';

// Day 9 Task 8 — the canonical, genuinely rendered app tabs. Every navigation
// entry point (mobile drawer, sidebar, rail, bottom nav) must map to one of
// these — a drawer item that collapses onto another tab with no real view (the
// old Folders/Favorites/Statistics/Settings/About aliases) is a dead item.
export const APP_TAB_IDS = ['home', 'editor', 'voice', 'calendar', 'ai', 'gamification', 'profile'] as const;
export type AppTabId = (typeof APP_TAB_IDS)[number];

export function isValidAppTab(id: string): id is AppTabId {
  return (APP_TAB_IDS as readonly string[]).includes(id);
}

// Day 9 Task 15 — the AI tutor header badge must reflect real connectivity.
export function tutorConnectionLabel(isOffline: boolean): string {
  return isOffline ? 'Offline' : 'Online';
}

export function tutorConnectionClass(isOffline: boolean): string {
  return isOffline ? ' tutor-status-offline' : '';
}

// True when the browser's local/session storage is usable
export function storageHealthy(): boolean {
  try {
    const probeKey = '__studysnap_probe__';
    window.localStorage.setItem(probeKey, '1');
    const value = window.localStorage.getItem(probeKey);
    window.localStorage.removeItem(probeKey);
    return value === '1';
  } catch {
    return false;
  }
}
