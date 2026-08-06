import helmet from 'helmet';
import cors from 'cors';
import { env } from '../config/env';

const prodCSP = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    'https://*.clerk.accounts.dev',
    'https://*.clerk.com',
    'https://js.clerk.com',
  ],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://*.clerk.com'],
  imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
  fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
  connectSrc: [
    "'self'",
    'https://*.clerk.accounts.dev',
    'https://*.clerk.com',
    'https://*',
    'http://localhost:4000',
  ],
  mediaSrc: ["'self'", 'blob:'],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  frameAncestors: ["'self'"],
  formAction: ["'self'"],
};

export const securityMiddleware = helmet({
  contentSecurityPolicy: env.isProd() ? { directives: prodCSP } : false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
});

const knownFrontendURLs = [
  env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'https://studysnap-sigma.vercel.app',
  'https://studysnap.vercel.app',
].filter(Boolean);

const corsOrigins = [...new Set(knownFrontendURLs)];

console.log(`[cors] ${env.isProd() ? 'PRODUCTION' : 'DEV'} allowed origins:`, corsOrigins);

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = corsOrigins.some((o) => {
      if (!o) return false;
      if (origin === o) return true;
      if (o.includes('localhost') && origin.includes('localhost')) return true;
      return false;
    });
    if (allowed || env.isDev()) {
      callback(null, true);
    } else {
      console.warn(`[cors] Blocked origin: ${origin}. Allowed:`, corsOrigins);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
});
