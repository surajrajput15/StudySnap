import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '../config/env';
import { DB_STATEMENT_TIMEOUT_MS } from '../config/constants';
import * as schema from './schema';

// Phase 1 P0: bound every Neon HTTP round-trip. Without this a stalled
// database connection pins the Express handler indefinitely (the audit found
// zero timeouts on all DB access). neonConfig.fetchFunction wraps the global
// fetch used by the driver; timed-out queries reject so route catch blocks
// return 500 instead of hanging.
if (typeof fetch !== 'undefined') {
  const baseFetch = neonConfig.fetchFunction ?? fetch;
  neonConfig.fetchFunction = async (input: unknown, init?: unknown) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DB_STATEMENT_TIMEOUT_MS);
    try {
      const initRecord = (init ?? {}) as Record<string, unknown>;
      return await baseFetch(input as never, { ...initRecord, signal: controller.signal } as never);
    } finally {
      clearTimeout(timer);
    }
  };
}

export function createDb() {
  if (!env.DATABASE_URL) {
    return null;
  }
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export const db = createDb();
export * from './schema';

export function getDb() {
  return db;
}
