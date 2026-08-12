import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionEnv } from '../src/config/env';

// `validateProductionEnv` reads process.env at CALL time, so this module can be
// statically imported once and the environment mutated per test. A local .env
// can never interfere because dotenv does not override already-set variables.
//
// Approved boot-blockers in production are exactly DATABASE_URL and
// CLERK_SECRET_KEY. Cloudinary stays call-time fail-closed (services/storage.ts)
// and GROQ_API_KEY fails at request time (services/ai.ts), so neither may block
// boot.

const ENV_KEYS = [
  'NODE_ENV',
  'FRONTEND_URL',
  'DATABASE_URL',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SECRET',
  'GROQ_API_KEY',
] as const;

const saved = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

function setEnv(partial: Record<string, string>): void {
  for (const key of ENV_KEYS) {
    if (key in partial) process.env[key] = partial[key];
    else delete process.env[key];
  }
}

function productionSet(): Record<string, string> {
  return {
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://studysnap-sigma.vercel.app',
    DATABASE_URL: 'postgres://studysnap.example/db',
    CLERK_SECRET_KEY: 'sk_test_example',
    CLERK_WEBHOOK_SECRET: 'whsec_example',
    GROQ_API_KEY: 'gsk_example',
  };
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('non-production environments never fail validation', () => {
  setEnv({ NODE_ENV: 'development' });
  assert.deepEqual(validateProductionEnv(), []);

  // Even with every variable blank, dev/test must never abort.
  setEnv({ NODE_ENV: 'development', DATABASE_URL: '', CLERK_SECRET_KEY: '' });
  assert.deepEqual(validateProductionEnv(), []);
});

test('production with every required variable passes', () => {
  setEnv(productionSet());
  assert.deepEqual(validateProductionEnv(), []);
});

test('production with missing required variables throws, naming every gap', () => {
  setEnv({
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://studysnap-sigma.vercel.app',
    CLERK_WEBHOOK_SECRET: 'whsec_example',
    GROQ_API_KEY: 'gsk_example',
  });
  assert.throws(() => validateProductionEnv(), (err: unknown) => {
    const e = err as Error;
    return (
      e instanceof Error &&
      e.message.includes('DATABASE_URL') &&
      e.message.includes('CLERK_SECRET_KEY') &&
      e.message.toLowerCase().includes('production')
    );
  });
});

test('blank or whitespace-only required values count as missing', () => {
  setEnv({ ...productionSet(), DATABASE_URL: '   ', CLERK_SECRET_KEY: '' });
  assert.throws(() => validateProductionEnv(), (err: unknown) => {
    const e = err as Error;
    return e instanceof Error && e.message.includes('DATABASE_URL') && e.message.includes('CLERK_SECRET_KEY');
  });
});

test('GROQ_API_KEY is NOT a boot blocker — AI fails at request time instead', () => {
  const set = productionSet();
  set.GROQ_API_KEY = '';
  setEnv({ ...set });
  assert.deepEqual(validateProductionEnv(), []);
});

test('missing Cloudinary credentials never block boot (call-time fail-closed instead)', () => {
  const savedCloud = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };
  try {
    // The plan requires storage to stay call-time fail-closed, so the boot
    // validator must NOT hard-require the Cloudinary set.
    setEnv(productionSet());
    process.env.CLOUDINARY_CLOUD_NAME = '';
    process.env.CLOUDINARY_API_KEY = '';
    process.env.CLOUDINARY_API_SECRET = '';
    assert.deepEqual(validateProductionEnv(), []);
  } finally {
    for (const [key, value] of Object.entries(savedCloud)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});