/**
 * Day 8 Task 3 (Phase A) — Injectable, backoff-managed sync scheduler.
 *
 * A single-flight sync engine that owns WHEN a sync runs but not WHAT runs:
 * the work itself is injected through `runTasks`, so the engine stays agnostic
 * about notes vs voice notes vs anything else that needs periodic sync.
 *
 * Guarantees:
 *  - Single-flight execution: a second trigger while a run is in flight is
 *    coalesced into exactly one follow-up run instead of a burst of requests.
 *  - Exponential backoff (default 2s → 60s) with jitter between retries, so a
 *    failing endpoint is not hammered.
 *  - HTTP 429 handling: a `SyncThrottledError` thrown by `runTasks` is honored
 *    via Retry-After (never fires before the server's requested delay).
 *  - Offline handling: runs are skipped while `navigator.onLine` is false and
 *    resumes on the `online` event.
 *  - Triggers: initial start, `online`/`offline` events, `visibilitychange`
 *    (catches up a throttled-background retry), and manual `requestSync()`.
 *  - StrictMode-safe start/stop: `start()` is idempotent and `stop()` tears
 *    down timers and listeners, so React's double-invocated effects are safe.
 *  - Per-user/account isolation: each account owns its own engine instance and
 *    scope key; stopping one account's engine can never affect another's.
 *
 * The engine runs in any runtime (browser or Node for tests): every DOM/navigator
 * touch is guarded so a non-browser environment degrades to online + no events.
 */

export type SyncPhase = 'idle' | 'running' | 'cooldown' | 'offline';

export interface SyncEngineStatus {
  phase: SyncPhase;
  /** True while a sync run is currently in flight. */
  inFlight: boolean;
  /** True when a trigger coalesced behind the in-flight run (a run is owed). */
  pending: boolean;
  lastRunAt: number | null;
  lastDurationMs: number | null;
  lastError: string | null;
  /** HTTP status of the last failed run (e.g. 429 when throttled). */
  lastHttpStatus: number | null;
  /** Epoch ms of the next scheduled automatic run, or null when none. */
  nextRunAt: number | null;
  /** Current exponential-backoff base (ms) after the last failure. */
  backoffMs: number | null;
  /** Consecutive failure count since the last success. */
  retryCount: number;
}

export interface SyncScope {
  /** Per-account identifier that keeps engine state isolated between users. */
  scopeKey: string;
}

export interface SyncEngineCallbacks {
  /**
   * The actual sync work. Resolve on success. Throw `SyncThrottledError` on an
   * HTTP 429 (the engine then honors Retry-After); throw anything else to
   * trigger the exponential backoff retry.
   */
  runTasks: (ctx: SyncScope) => Promise<unknown>;
  /** Optional observer for every status transition. */
  onStatus?: (status: SyncEngineStatus) => void;
}

export interface SyncEngineTiming {
  /** Base delay for the first retry (ms). Default 2000. */
  minBackoffMs?: number;
  /** Ceiling for the doubled backoff (ms). Default 60000. */
  maxBackoffMs?: number;
  /** Jitter ratio around the base (0..1). Default 0.3. */
  jitterRatio?: number;
}

export interface SyncEngine {
  /** Idempotent — safe under React StrictMode double-invocations. */
  start: () => void;
  /** Idempotent — cancels timers/listeners; in-flight run completes but never re-runs. */
  stop: () => void;
  /** Manual retry. Supersedes any pending backoff timer; coalesces if a run is in flight. */
  requestSync: () => void;
  /** Current snapshot of engine state. */
  getStatus: () => SyncEngineStatus;
  readonly scopeKey: string;
}

const DEFAULT_MIN_BACKOFF_MS = 2000;
const DEFAULT_MAX_BACKOFF_MS = 60000;
const DEFAULT_JITTER_RATIO = 0.3;

export type SyncTrigger = 'initial' | 'scheduled' | 'manual' | 'reconnect' | 'visibility';

/**
 * Fine-grained status emitted by the sync LAYERS (notesSync.ts, voiceNotesSync.ts)
 * via their optional `onStatus` callback. The engine's runTasks wrapper receives
 * these and translates a `rateLimited` event into a `SyncThrottledError` so the
 * engine honors Retry-After. Additive — sync layers keep returning void.
 */
export type SyncChildStatusEvent =
  | { type: 'syncing' }
  | { type: 'synced' }
  | { type: 'rateLimited'; status: number; retryAfterMs: number }
  | { type: 'error'; message: string };

/**
 * Thrown by `runTasks` when the server throttled the request (HTTP 429). The
 * engine reads `retryAfterMs` and never fires the next run before it. When the
 * 429 carries no Retry-After, the normal exponential backoff applies instead.
 */
export class SyncThrottledError extends Error {
  readonly status: number;
  readonly retryAfterMs: number;
  constructor(status: number, retryAfterMs: number, message = 'Sync throttled by the server') {
    super(message);
    this.name = 'SyncThrottledError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

export function createSyncEngine(
  scopeKey: string,
  callbacks: SyncEngineCallbacks,
  timing: SyncEngineTiming = {}
): SyncEngine {
  const minBackoffMs = timing.minBackoffMs ?? DEFAULT_MIN_BACKOFF_MS;
  const maxBackoffMs = timing.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
  const jitterRatio = Math.min(1, Math.max(0, timing.jitterRatio ?? DEFAULT_JITTER_RATIO));
  const { runTasks } = callbacks;
  const emit = callbacks.onStatus;

  // ── internal state ─────────────────────────────────────────────────────────
  let started = false;
  let stopped = false;
  let running = false;
  let coalesced = false;
  let backoff = minBackoffMs;
  let timer: ReturnType<typeof setTimeout> | null = null;

  let status: SyncEngineStatus = {
    phase: 'idle',
    inFlight: false,
    pending: false,
    lastRunAt: null,
    lastDurationMs: null,
    lastError: null,
    lastHttpStatus: null,
    nextRunAt: null,
    backoffMs: null,
    retryCount: 0,
  };

  function setStatus(patch: Partial<SyncEngineStatus>): void {
    status = { ...status, ...patch };
    emit?.(status);
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /** Jittered delay around the given base: base × (1 ∓ jitterRatio). */
  function jitter(base: number): number {
    if (jitterRatio <= 0 || base <= 0) return base;
    const ratio = 1 - jitterRatio + Math.random() * 2 * jitterRatio;
    return Math.round(base * ratio);
  }

  function schedule(delayMs: number): void {
    clearTimer();
    setStatus({ nextRunAt: Date.now() + delayMs });
    timer = setTimeout(() => {
      timer = null;
      if (!stopped) void run('scheduled');
    }, delayMs);
  }

  async function run(_trigger: SyncTrigger): Promise<void> {
    if (stopped) return;
    if (running) {
      // Single-flight: remember the request, serve it exactly once afterwards.
      coalesced = true;
      if (!status.pending) setStatus({ pending: true });
      return;
    }
    // A fresh trigger supersedes a pending backoff timer (e.g. manual retry or
    // a reconnect), but only when we are actually going to run now.
    if (!isOnline()) {
      clearTimer();
      setStatus({ phase: 'offline', inFlight: false, nextRunAt: null });
      return;
    }
    clearTimer();

    running = true;
    const startedAt = Date.now();
    setStatus({ phase: 'running', inFlight: true, pending: coalesced });
    try {
      await runTasks({ scopeKey });
      // Success resets the retry staircase so the next failure starts fresh.
      backoff = minBackoffMs;
      setStatus({
        phase: 'idle',
        inFlight: false,
        pending: coalesced,
        lastRunAt: startedAt,
        lastDurationMs: Date.now() - startedAt,
        lastError: null,
        lastHttpStatus: null,
        nextRunAt: null,
        backoffMs: null,
        retryCount: 0,
      });
    } catch (err) {
      const throttled = err instanceof SyncThrottledError;
      const httpStatus = throttled ? err.status : null;
      const retryCount = status.retryCount + 1;
      const nextBackoff = Math.min(maxBackoffMs, backoff * 2);
      // Delay the retry by the CURRENT base (first retry ≈ minBackoffMs, i.e. 2s)
      // and only then double the base for the next attempt, so the staircase is
      // exactly "2s → 60s + jitter" as the approved plan requires. A server-
      // provided Retry-After is authoritative and is never cut short; without
      // one, fall back to the jittered exponential backoff.
      const delay = throttled && err.retryAfterMs > 0 ? Math.max(err.retryAfterMs, jitter(backoff)) : jitter(backoff);
      backoff = nextBackoff;
      setStatus({
        phase: 'cooldown',
        inFlight: false,
        pending: coalesced,
        lastRunAt: startedAt,
        lastDurationMs: Date.now() - startedAt,
        lastError: err instanceof Error ? err.message : 'Sync failed',
        lastHttpStatus: httpStatus,
        backoffMs: nextBackoff,
        retryCount,
      });
      schedule(delay);
    } finally {
      running = false;
    }

    // Serve the coalesced request now that the in-flight run finished.
    if (coalesced && !stopped) {
      coalesced = false;
      setStatus({ pending: false });
      void run('manual');
    }
  }

  function handleConnectivity(): void {
    if (!started || stopped) return;
    void run(isOnline() ? 'reconnect' : 'visibility');
  }

  function handleVisibility(): void {
    if (!started || stopped) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    // The browser throttles timers in background tabs: catch up a scheduled
    // retry that came due while hidden, or flush a sync that `online` could not
    // deliver reliably while the tab was hidden (reconnect happened off-screen).
    if (
      (status.nextRunAt !== null && status.nextRunAt <= Date.now()) ||
      (status.phase === 'offline' && isOnline())
    ) {
      void run('visibility');
    }
  }

  return {
    scopeKey,

    start() {
      if (started) return;
      started = true;
      stopped = false;
      if (typeof window !== 'undefined') {
        window.addEventListener('online', handleConnectivity);
        window.addEventListener('offline', handleConnectivity);
      }
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibility);
      }
      void run('initial');
    },

    stop() {
      if (!started) return;
      started = false;
      stopped = true;
      clearTimer();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleConnectivity);
        window.removeEventListener('offline', handleConnectivity);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      setStatus({ phase: 'idle', inFlight: false, pending: false, nextRunAt: null });
    },

    requestSync() {
      if (!started || stopped) return;
      void run('manual');
    },

    getStatus() {
      return { ...status };
    },
  };
}