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
