export const JSON_BODY_LIMIT = '10mb';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const AI_MODEL = 'llama-3.1-8b-instant';

export const CACHE_TTL_NOTES_SECONDS = 60;

export const PIN_PATTERN = /^\d{4}$/;
export const PIN_PATTERN_MESSAGE = 'PIN must be 4 digits';

export const REVISION_INTERVAL_DAYS = {
  easy: 7,
  medium: 3,
  hard: 1,
} as const;

export type RevisionRating = keyof typeof REVISION_INTERVAL_DAYS;

export const DEFAULT_CATEGORIES = [
  { id: 'cat-physics', name: 'Physics', color: '#3B82F6' },
  { id: 'cat-chemistry', name: 'Chemistry', color: '#10B981' },
  { id: 'cat-maths', name: 'Maths', color: '#F59E0B' },
  { id: 'cat-biology', name: 'Biology', color: '#EC4899' },
  { id: 'cat-computer', name: 'Computer', color: '#8B5CF6' },
] as const;
