import 'dotenv/config';

const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV === 'development';
const isProd = NODE_ENV === 'production';

if (!process.env.FRONTEND_URL && isProd) {
  console.warn('[env] ⚠️ FRONTEND_URL not set in production. Set it to your Vercel frontend URL.');
}
if (!process.env.GROQ_API_KEY && isProd) {
  console.warn('[env] ⚠️ GROQ_API_KEY not set in production. AI will return mock responses.');
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
