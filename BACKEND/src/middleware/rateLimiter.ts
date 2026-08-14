import rateLimit from 'express-rate-limit';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

const limits = {
  standardHeaders: true,
  legacyHeaders: false,
} as const;

// Day 10 Task 3 — the global API limiter is a coarse per-IP DoS guard for the
// whole API surface, but endpoints that already enforce their OWN dedicated,
// tighter limiter (AI calls and voice uploads) must NOT be double-counted
// against the global budget. A recording session of ~20 uploads plus hydration
// GET/DELETE calls plus a few AI chats would otherwise trip the 100/15-min
// global cap mid-session. Their dedicated limiters still protect those routes.
const GLOBAL_LIMIT_SKIP_PATHS = [/^\/api\/ai(?:\/|$)/, /^\/api\/voice-notes(?:\/|$)/];

export const apiLimiter = rateLimit({
  ...limits,
  windowMs: 15 * MINUTE,
  max: 100,
  // Day 17 Task 2 fix — the limiter is mounted at `/api/`, so `req.path` is
  // `/ai/chat`, NOT `/api/ai/chat`, and the skip patterns never matched: every
  // AI/voice call was double-counted against BOTH its dedicated limiter and the
  // global 100/15-min budget, risking mid-session 429s. Join baseUrl + path to
  // reconstruct the full API route before testing the skip patterns.
  skip: (req) => GLOBAL_LIMIT_SKIP_PATHS.some((pattern) => pattern.test(`${req.baseUrl}${req.path}`)),
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

export const aiLimiter = rateLimit({
  ...limits,
  windowMs: MINUTE,
  max: 20,
  message: { success: false, error: 'AI rate limit exceeded. Please wait a moment.' },
});

export const pinLimiter = rateLimit({
  ...limits,
  windowMs: 15 * MINUTE,
  max: 20,
  message: { success: false, error: 'Too many PIN attempts. Please try again later.' },
});

export const voiceUploadLimiter = rateLimit({
  ...limits,
  windowMs: 15 * MINUTE,
  max: 20,
  message: { success: false, error: 'Too many voice uploads. Please try again later.' },
});

// Day 14 Task 4 — the global limiter SKIPS the whole /api/voice-notes namespace
// so recording bursts are not double-counted, but that leaves GET/DELETE
// completely unthrottled (only POST had a dedicated limiter). This per-IP query
// limiter closes the gap for hydration GETs and deletes while uploads keep
// their own tighter budget. ~120 reads/15 min is generous for legit sessions.
export const voiceQueryLimiter = rateLimit({
  ...limits,
  windowMs: 15 * MINUTE,
  max: 120,
  message: { success: false, error: 'Too many voice note requests. Please try again later.' },
});

// Day 14 Task 4 — webhooks are mounted BEFORE the global /api limiter, so they
// would otherwise bypass ALL throttling. They are signature-verified (Clerk
// only), so the real defense is the signature — but a generous, dedicated
// limiter is cheap defense-in-depth that still leaves room for legit signup
// bursts (~500 events / 15 min per Clerk edge IP).
export const webhookLimiter = rateLimit({
  ...limits,
  windowMs: 15 * MINUTE,
  max: 500,
  message: { success: false, error: 'Too many webhook requests.' },
});
