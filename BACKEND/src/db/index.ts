import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '../config/env';
import * as schema from './schema';

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
  if (!db) {
    throw new Error('Database not configured. Set DATABASE_URL env.');
  }
  return db;
}
