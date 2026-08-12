import rateLimit from 'express-rate-limit';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const limits = {
  standardHeaders: true,
  legacyHeaders: false,
} as const;

export const apiLimiter = rateLimit({
  ...limits,
  windowMs: 15 * MINUTE,
  max: 100,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

export const authLimiter = rateLimit({
  ...limits,
  windowMs: HOUR,
  max: 10,
  message: { success: false, error: 'Too many auth attempts. Please try again later.' },
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
