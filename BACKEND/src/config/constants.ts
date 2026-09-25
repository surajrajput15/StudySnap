export const JSON_BODY_LIMIT = '10mb';

// Phase 1 P0: per-query budget for Neon HTTP round-trips (wired via
// neonConfig.fetchFunction in src/db/index.ts).
export const DB_STATEMENT_TIMEOUT_MS = 15_000;

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// Phase 1 P0: Cloudinary call budgets. A hung upload previously pinned the
// Express handler (and its 50MB buffer) forever; a hung destroy blocked
// note/voice deletes the same way.
export const VOICE_UPLOAD_TIMEOUT_MS = 60_000;
export const VOICE_DESTROY_TIMEOUT_MS = 15_000;

// Phase 1 P0: per-user daily voice-upload budget (bill DoS guard). 500MB is
// ~10 full-size memos/day — no legitimate user hits it, but an attacker
// rotating accounts cannot pile unbounded Cloudinary spend.
export const VOICE_DAILY_BYTE_QUOTA = 500 * 1024 * 1024;
export const VOICE_QUOTA_TTL_SECONDS = 48 * 60 * 60;

// Phase 1 P0: Groq call budget. Free-tier cold boots take 20-50s, so the
// budget is generous — but a hung upstream must never pin a handler forever.
export const AI_REQUEST_TIMEOUT_MS = 45_000;

// Phase 1 P0: per-user daily AI budget (bill DoS guard). Whichever hits
// first wins. 429 + Retry-After on exceed; the frontend already renders a
// "busy" bubble for 429.
export const AI_DAILY_REQUEST_QUOTA = 50;
export const AI_DAILY_CHAR_QUOTA = 500_000;
export const AI_QUOTA_TTL_SECONDS = 48 * 60 * 60;

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
