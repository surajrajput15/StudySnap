import { Redis } from '@upstash/redis';
import { env } from '../config/env';

// Phase 1 P0: Redis calls previously had no timeout — a stalled Upstash
// connection pinned the Express handler. 2s race, fail-silent preserved.
const REDIS_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('[cache] Redis call timed out')), REDIS_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

let redis: Redis | null = null;

if (env.UPSTASH_REDIS_URL && env.UPSTASH_REDIS_TOKEN) {
  redis = new Redis({
    url: env.UPSTASH_REDIS_URL,
    token: env.UPSTASH_REDIS_TOKEN,
  });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    return await withTimeout(redis.get<T>(key));
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds = 300) {
  if (!redis) return;
  try {
    await withTimeout(redis.set(key, value, { ex: ttlSeconds }));
  } catch {
    // silently fail
  }
}

export async function invalidateUserCache(userId: string) {
  if (!redis) return;
  try {
    const keys = await redis.keys(`${userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // silently fail
  }
}

/**
 * Phase 1 P0: atomic increment-and-read for quota counters. Returns the new
 * value, or null when Redis is unavailable — callers treat null as
 * "quota unknown, fail OPEN" (availability beats strictness for uploads).
 */
export async function cacheIncrBy(key: string, delta: number, ttlSeconds: number): Promise<number | null> {
  if (!redis) return null;
  try {
    const value = await withTimeout(redis.incrby(key, delta));
    // Refresh the TTL window on every increment; ignore TTL errors.
    await withTimeout(redis.expire(key, ttlSeconds)).catch(() => {});
    return typeof value === 'number' ? value : Number(value);
  } catch {
    return null;
  }
}
