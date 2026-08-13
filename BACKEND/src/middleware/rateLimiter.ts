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
  skip: (req) => GLOBAL_LIMIT_SKIP_PATHS.some((pattern) => pattern.test(req.path)),
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
