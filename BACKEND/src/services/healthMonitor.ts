import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { env } from '../config/env';
import { cacheGet, cacheSet } from './cache';
import { dispatchHealthAlert, dispatchHealthRecoveredAlert } from './alertDispatcher';

export interface ServiceHealthState {
  database: 'healthy' | 'degraded' | 'down';
  cache: 'healthy' | 'degraded' | 'down';
  ai: 'healthy' | 'degraded' | 'down';
  lastChecked: number;
}

let lastState: ServiceHealthState = {
  database: 'healthy',
  cache: 'healthy',
  ai: 'healthy',
  lastChecked: Date.now(),
};

let probeTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Runs a probe against PostgreSQL Neon, Upstash Redis, and Groq configurations.
 */
export async function runHealthProbe(): Promise<{
  success: boolean;
  status: ServiceHealthState;
  details: Record<string, string>;
}> {
  const details: Record<string, string> = {};
  let dbStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
  let cacheStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
  let aiStatus: 'healthy' | 'degraded' | 'down' = 'healthy';

  // 1. Database Probe (Neon Postgres)
  try {
    const db = getDb();
    if (!db) {
      if (env.isProd()) {
        dbStatus = 'down';
        details.database = 'DATABASE_URL unset in production';
      } else {
        dbStatus = 'degraded';
        details.database = 'Running in in-memory fallback';
      }
    } else {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      const latency = Date.now() - start;
      details.database = `Neon PostgreSQL connected (${latency}ms)`;
    }
  } catch (err) {
    dbStatus = 'down';
    const msg = err instanceof Error ? err.message : String(err);
    details.database = `Database query failed: ${msg}`;
  }

  // 2. Cache Probe (Upstash Redis)
  try {
    if (!env.UPSTASH_REDIS_URL || !env.UPSTASH_REDIS_TOKEN) {
      cacheStatus = env.isProd() ? 'degraded' : 'healthy';
      details.cache = 'In-memory fallback cache';
    } else {
      const probeKey = '__studysnap_health_probe__';
      await cacheSet(probeKey, '1', 60);
      const val = await cacheGet<string>(probeKey);
      if (val === '1') {
        details.cache = 'Upstash Redis operational';
      } else {
        cacheStatus = 'degraded';
        details.cache = 'Upstash Redis write/read mismatch';
      }
    }
  } catch (err) {
    cacheStatus = 'down';
    details.cache = `Redis probe failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 3. AI Provider Probe
  if (!env.GROQ_API_KEY) {
    aiStatus = env.isProd() ? 'down' : 'degraded';
    details.ai = 'GROQ_API_KEY is not configured';
  } else {
    details.ai = 'Groq LPU API key active';
  }

  // State Transition Detection & Telegram Alerts
  if (dbStatus === 'down' && lastState.database !== 'down') {
    dispatchHealthAlert({
      service: 'Neon PostgreSQL Database',
      issue: details.database,
    });
  } else if (dbStatus === 'healthy' && lastState.database === 'down') {
    dispatchHealthRecoveredAlert({
      service: 'Neon PostgreSQL Database',
      status: 'Connection restored to Neon PostgreSQL',
    });
  }

  if (cacheStatus === 'down' && lastState.cache !== 'down') {
    dispatchHealthAlert({
      service: 'Upstash Redis Cache',
      issue: details.cache,
    });
  } else if (cacheStatus === 'healthy' && lastState.cache === 'down') {
    dispatchHealthRecoveredAlert({
      service: 'Upstash Redis Cache',
      status: 'Cache service restored',
    });
  }

  if (aiStatus === 'down' && lastState.ai !== 'down') {
    dispatchHealthAlert({
      service: 'Groq Cloud AI Provider',
      issue: details.ai,
    });
  } else if (aiStatus === 'healthy' && lastState.ai === 'down') {
    dispatchHealthRecoveredAlert({
      service: 'Groq Cloud AI Provider',
      status: 'AI Provider recovered',
    });
  }

  lastState = {
    database: dbStatus,
    cache: cacheStatus,
    ai: aiStatus,
    lastChecked: Date.now(),
  };

  const isHealthy = dbStatus !== 'down' && cacheStatus !== 'down' && aiStatus !== 'down';
  return { success: isHealthy, status: lastState, details };
}

/**
 * Initializes continuous background health monitoring.
 */
export function startHealthMonitor(intervalMinutes = 5): void {
  if (probeTimer) return;
  const intervalMs = intervalMinutes * 60 * 1000;

  // Run initial probe after a short 5-second warm-up
  setTimeout(() => {
    void runHealthProbe();
  }, 5000).unref();

  probeTimer = setInterval(() => {
    void runHealthProbe();
  }, intervalMs);

  if (typeof probeTimer.unref === 'function') {
    probeTimer.unref();
  }

  // Attach process crash handlers
  process.on('unhandledRejection', (reason) => {
    console.error('[health] ❌ Unhandled rejection:', reason);
    dispatchHealthAlert({
      service: 'StudySnap Node Server',
      issue: `Unhandled promise rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
    });
  });

  process.on('uncaughtException', (err) => {
    console.error('[health] ❌ Uncaught exception:', err);
    dispatchHealthAlert({
      service: 'StudySnap Node Server',
      issue: `Fatal uncaught exception: ${err.message}`,
    });
  });
}

/**
 * Stops background health monitoring.
 */
export function stopHealthMonitor(): void {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
}
