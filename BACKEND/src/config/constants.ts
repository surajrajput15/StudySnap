export const JSON_BODY_LIMIT = '10mb';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// Day 14 Task 2 — cap note content at ~1M chars (~500 pages of plain text) so
// the note upsert endpoint can never be flooded with unbounded bodies.
export const MAX_NOTE_CONTENT_CHARS = 1_000_000;

// Aug 2026 — Groq decommissioned every meta-llama chat model
// (`llama-3.1-8b-instant` now returns model_not_found), so every AI call was
// failing with a 500. gpt-oss-20b is the closest replacement: same fast tier,
// verified clean Markdown AND clean JSON-array output (MCQ/flashcard parsing).
export const AI_MODEL = 'openai/gpt-oss-20b';

export const CACHE_TTL_NOTES_SECONDS = 60;

export const PIN_PATTERN = /^\d{4}$/;
export const PIN_PATTERN_MESSAGE = 'PIN must be 4 digits';

export const DEFAULT_CATEGORIES = [
  { id: 'cat-physics', name: 'Physics', color: '#3B82F6' },
  { id: 'cat-chemistry', name: 'Chemistry', color: '#10B981' },
  { id: 'cat-maths', name: 'Maths', color: '#F59E0B' },
  { id: 'cat-biology', name: 'Biology', color: '#EC4899' },
  { id: 'cat-computer', name: 'Computer', color: '#8B5CF6' },
] as const;
