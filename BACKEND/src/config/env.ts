import 'dotenv/config';

const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV === 'development';
const isProd = NODE_ENV === 'production';

if (!process.env.FRONTEND_URL && isProd) {
  console.warn('[env] ⚠️ FRONTEND_URL not set in production. Set it to your Vercel frontend URL.');
}
if (!process.env.GROQ_API_KEY && isProd) {
  console.warn('[env] ⚠️ GROQ_API_KEY not set in production. AI requests will fail with 503 until configured.');
}

/**
 * Day 8 Task 3 (Phase C) — production fail-fast validation.
 *
 * In production the backend never quietly degrades to dev/mock behavior, so the
 * variables the app CANNOT run without are enforced at boot rather than warned
 * about. Values are read from `process.env` at CALL time (not the module-load
 * snapshot) so the validator always reflects the actual runtime environment.
 * Returns the (always-empty) list of missing names in non-production
 * environments, making a plain call a no-op during development; in production
 * it throws with every missing variable named so operators can fix the config
 * in one pass. Cloudinary is intentionally NOT required here — voice storage
 * stays call-time fail-closed (see services/storage.ts) per the plan — and
 * GROQ_API_KEY is intentionally NOT required because the AI service fails
 * explicitly at request time (see services/ai.ts) instead of blocking boot.
 * Only the database and auth credentials a production boot cannot survive
 * without are enforced here.
 */
const PRODUCTION_REQUIRED_ENV: ReadonlyArray<readonly [name: string, value: () => string | undefined]> = [
  ['DATABASE_URL', () => process.env.DATABASE_URL],
  ['CLERK_SECRET_KEY', () => process.env.CLERK_SECRET_KEY],
];

export function validateProductionEnv(): string[] {
  if ((process.env.NODE_ENV || 'development') !== 'production') return [];
  const missing = PRODUCTION_REQUIRED_ENV.filter(([, value]) => {
    const v = value();
    return !v || v.trim() === '';
  }).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `[env] ❌ Production boot aborted — missing required environment variables: ${missing.join(', ')}. ` +
        'Production never falls back to mock/dev behavior; set these before starting the server.'
    );
  }
  return missing;
}

export const env = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV,
  FRONTEND_URL: process.env.FRONTEND_URL || (isDev ? 'http://localhost:3000' : ''),

  DATABASE_URL: process.env.DATABASE_URL || '',

  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || '',
  CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET || '',

  GROQ_API_KEY: process.env.GROQ_API_KEY || '',

  UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL || '',
  UPSTASH_REDIS_TOKEN: process.env.UPSTASH_REDIS_TOKEN || '',

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  BREVO_API_KEY: process.env.BREVO_API_KEY || '',
  BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || 'study@notes.ai',

  isDev: () => isDev,
  isProd: () => isProd,
};
