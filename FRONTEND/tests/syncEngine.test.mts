import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSyncEngine,
  SyncThrottledError,
  type SyncEngine,
} from '../lib/sync/syncEngine.ts';

const clock = makeClockWrapper();

/** Node's `mock.timers` is a live singleton; wrap it so the helper reads stay small. */
function makeClockWrapper() {
  const timers = mock.timers;
  return {
    enable: (cfg: { apis: readonly ('setTimeout' | 'setInterval' | 'setImmediate' | 'Date')[] }) => timers.enable(cfg),
    tick: (ms: number) => timers.tick(ms),
    reset: () => timers.reset(),
  };
}

class FakeEventTarget {
  private listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, fn: () => void): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(fn);
  }

  removeEventListener(type: string, fn: () => void): void {
    this.listeners.get(type)?.delete(fn);
  }

  dispatch(type: string): void {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn();
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

const g = globalThis as unknown as {
  window: FakeEventTarget;
  document: FakeEventTarget & { visibilityState: DocumentVisibilityState };
  navigator: { onLine?: boolean };
};

function setOnline(on: boolean): void {
  g.navigator.onLine = on;
}

function flush(): Promise<void> {
  return new Promise((r) => setImmediate(r));
}

/** Advances the mocked clock, firing pending timers, and drains microtasks. */
async function advance(ms: number): Promise<void> {
  await clock.tick(ms);
  await flush();
}

function makeSuccessEngine(timing?: Record<string, number>): { engine: SyncEngine; calls: () => number } {
  let calls = 0;
  const engine = createSyncEngine(
    'test-scope',
    { runTasks: () => { calls += 1; return Promise.resolve(); } },
    timing
  );
  return { engine, calls: () => calls };
}

function lastError(engine: SyncEngine): string | null {
  return engine.getStatus().lastError;
}

beforeEach(() => {
  clock.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  g.window = new FakeEventTarget();
  g.document = Object.assign(new FakeEventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
  // Node 21+ ships a `navigator` global; replace it with a controllable stub.
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    enumerable: true,
    value: { onLine: true },
  });
});

afterEach(() => {
  clock.reset();
});

test('start() is idempotent — a second start never double-runs (StrictMode-safe)', async () => {
  const { engine, calls } = makeSuccessEngine();
  engine.start();
  engine.start();
  await flush();
  assert.equal(calls(), 1, 'initial run fired exactly once');
  engine.stop();
});

test('single-flight: a trigger during an in-flight run coalesces into exactly one follow-up', async () => {
  let resolveFirst!: () => void;
  let resolveSecond!: () => void;
  let calls = 0;
  const engine = createSyncEngine('test-scope', {
    runTasks: () => {
      calls += 1;
      if (calls === 1) return new Promise<void>((r) => { resolveFirst = r; });
      return new Promise<void>((r) => { resolveSecond = r; });
    },
  });

  engine.start();
  await flush();
  assert.equal(calls, 1, 'initial run in flight');
  assert.equal(engine.getStatus().inFlight, true);

  // Two triggers land while the first run is still pending.
  engine.requestSync();
  engine.requestSync();
  await flush();
  assert.equal(calls, 1, 'no second request burst while in flight');
  assert.equal(engine.getStatus().pending, true, 'coalesced request remembered');

  resolveFirst();
  await flush();
  assert.equal(calls, 2, 'exactly one follow-up run served after the in-flight run');
  assert.equal(engine.getStatus().inFlight, true, 'follow-up run is the in-flight one');

  resolveSecond();
  await flush();
  assert.equal(calls, 2, 'no further run — the coalesced request was served once');
  assert.equal(engine.getStatus().phase, 'idle');
  assert.equal(engine.getStatus().pending, false);
  engine.stop();
});

test('exponential backoff: 2s → 60s capped, retry count climbs, success resets', async () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  let calls = 0;
  const engine = createSyncEngine(
    'test-scope',
    {
      runTasks: () => {
        calls += 1;
        if (calls === 1) throw new Error('boom');
        if (calls === 2) throw new Error('boom');
        return Promise.resolve();
      },
    },
    { jitterRatio: 0 }
  );

  engine.start();
  await flush();
  assert.equal(calls, 1);
  let s = engine.getStatus();
  assert.equal(s.phase, 'cooldown');
  assert.equal(s.retryCount, 1);
  assert.equal(s.backoffMs, 4000, 'base doubled for the NEXT attempt');
  assert.ok(s.nextRunAt !== null && s.nextRunAt <= Date.now() + 2000, 'first retry ≈ 2s');
  assert.ok(s.lastRunAt !== null);
  assert.equal(lastError(engine), 'boom');

  await advance(1000);
  assert.equal(calls, 1, 'no retry before the 2s wait elapses');

  await advance(1000);
  assert.equal(calls, 2, 'first retry fired after the 2s window');
  s = engine.getStatus();
  assert.equal(s.retryCount, 2);
  assert.equal(s.backoffMs, 8000, 'backoff doubled again');

  await advance(4000);
  assert.equal(calls, 3, 'second retry fired after 4s');
  s = engine.getStatus();
  assert.equal(s.phase, 'idle', 'success resets to idle');
  assert.equal(s.retryCount, 0, 'retry count reset on success');
  assert.equal(s.backoffMs, null, 'backoff reset on success');
  assert.equal(lastError(engine), null);

  Math.random = originalRandom;
  engine.stop();
});

test('failure staircase caps at maxBackoffMs (60s)', async () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  let calls = 0;
  const engine = createSyncEngine(
    'test-scope',
    {
      runTasks: () => {
        calls += 1;
        throw new Error('persistent');
      },
    },
    { jitterRatio: 0 }
  );

  engine.start();
  await flush();
  // 2s, 4s, 8s, 16s, 32s, then the doubled value is capped at 60s.
  for (const wait of [2000, 4000, 8000, 16000, 32000]) {
    await advance(wait);
  }
  assert.equal(calls, 6, 'first run + 5 retries, one per backoff window');
  let s = engine.getStatus();
  assert.equal(s.backoffMs, 64000 <= 60000 ? 64000 : 60000);
  assert.ok(s.retryCount >= 6);

  // A further retry must not exceed the 60s ceiling.
  const upper = s.nextRunAt === null ? 0 : s.nextRunAt - Date.now();
  await advance((upper > 0 ? upper : 60000) + 1);
  s = engine.getStatus();
  assert.equal(calls, 7, 'one more retry after the capped window');
  assert.ok((s.backoffMs ?? 0) <= 60000, 'backoff never exceeds the 60s cap');

  Math.random = originalRandom;
  engine.stop();
});

test('429 with Retry-After is honored — the engine never fires before the server delay', async () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  let calls = 0;
  const engine = createSyncEngine(
    'test-scope',
    {
      runTasks: () => {
        calls += 1;
        throw new SyncThrottledError(429, 30000);
      },
    },
    { jitterRatio: 0 }
  );

  engine.start();
  await flush();
  assert.equal(calls, 1);
  const s = engine.getStatus();
  assert.equal(s.phase, 'cooldown');
  assert.equal(s.lastHttpStatus, 429);
  assert.equal(s.retryCount, 1);
  const delay = (s.nextRunAt ?? 0) - Date.now();
  assert.ok(delay >= 30000, `server Retry-After (≥30s) honored, got ${delay}ms`);

  await advance(29900);
  assert.equal(calls, 1, 'no retry before Retry-After elapses');

  await advance(4000);
  assert.equal(calls, 2, 'retry fires once Retry-After elapsed');
  engine.stop();
  Math.random = originalRandom;
});

test('429 without Retry-After falls back to the jittered exponential backoff', async () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  const engine = createSyncEngine(
    'test-scope',
    {
      runTasks: () => {
        throw new SyncThrottledError(429, 0);
      },
    },
    { jitterRatio: 0 }
  );

  engine.start();
  await flush();
  const s = engine.getStatus();
  assert.equal(s.lastHttpStatus, 429);
  assert.equal(s.retryCount, 1);
  const delay = (s.nextRunAt ?? 0) - Date.now();
  assert.equal(delay, 2000, 'plain backoff applies when no Retry-After was sent');
  engine.stop();
  Math.random = originalRandom;
});

test('offline: runs are skipped and resume on the online event', async () => {
  let calls = 0;
  const engine = createSyncEngine('test-scope', {
    runTasks: () => {
      calls += 1;
      return Promise.resolve();
    },
  });

  setOnline(false);
  g.window.dispatch('offline');

  engine.start();
  await flush();
  assert.equal(calls, 0, 'no run while offline');
  assert.equal(engine.getStatus().phase, 'offline');

  setOnline(true);
  g.window.dispatch('online');
  await flush();
  assert.equal(calls, 1, 'run fired on reconnect');
  assert.equal(engine.getStatus().phase, 'idle');
  engine.stop();
});

test('visibilitychange: no spurious run when nothing is due, but a due retry is caught up', async () => {
  let calls = 0;
  const engine = createSyncEngine('test-scope', {
    runTasks: () => {
      calls += 1;
      return Promise.resolve();
    },
  });

  engine.start();
  await flush();
  assert.equal(calls, 1);

  // Visible + nothing pending → the visibility handler must do nothing.
  g.document.visibilityState = 'visible';
  g.document.dispatch('visibilitychange');
  await flush();
  assert.equal(calls, 1, 'no spurious run on a plain visibility event');

  // Offline reconnect delivered through visibility (e.g. the online event was
  // swallowed while hidden) must still flush.
  setOnline(false);
  g.window.dispatch('offline');
  await flush();
  assert.equal(engine.getStatus().phase, 'offline');

  setOnline(true);
  g.document.visibilityState = 'visible';
  g.document.dispatch('visibilitychange');
  await flush();
  assert.equal(calls, 2, 'visibility catches up an offline-recovery run');
  engine.stop();
});

test('manual requestSync() supersedes a pending backoff timer', async () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  let calls = 0;
  const engine = createSyncEngine(
    'test-scope',
    {
      runTasks: () => {
        calls += 1;
        throw new Error('still failing');
      },
    },
    { jitterRatio: 0 }
  );

  engine.start();
  await flush();
  assert.equal(calls, 1);
  assert.equal(engine.getStatus().phase, 'cooldown');
  assert.ok(engine.getStatus().nextRunAt !== null, 'a retry is scheduled');

  engine.requestSync();
  await flush();
  assert.equal(calls, 2, 'manual retry ignores the backoff wait');
  engine.stop();
  Math.random = originalRandom;
});

test('requestSync() before start() is a no-op and never crashes', async () => {
  let calls = 0;
  const engine = createSyncEngine('test-scope', {
    runTasks: () => {
      calls += 1;
      return Promise.resolve();
    },
  });
  engine.requestSync();
  await flush();
  assert.equal(calls, 0);
  assert.equal(engine.getStatus().phase, 'idle');
});

test('stop() cancels a pending retry and tears down listeners (idempotent)', async () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  let calls = 0;
  const engine = createSyncEngine(
    'test-scope',
    {
      runTasks: () => {
        calls += 1;
        throw new Error('failing');
      },
    },
    { jitterRatio: 0 }
  );

  engine.start();
  await flush();
  assert.equal(calls, 1);
  assert.equal(engine.getStatus().phase, 'cooldown');
  assert.equal(g.window.listenerCount('online'), 1, 'listener attached while started');

  engine.stop();
  engine.stop(); // idempotent
  assert.equal(engine.getStatus().phase, 'idle');
  assert.equal(engine.getStatus().nextRunAt, null, 'pending timer info cleared');
  assert.equal(g.window.listenerCount('online'), 0, 'listener removed on stop');

  await advance(10000);
  assert.equal(calls, 1, 'no retry fires after stop()');
  engine.stop();
  Math.random = originalRandom;
});

test('start() after stop() restarts cleanly (StrictMode remount)', async () => {
  let calls = 0;
  const engine = createSyncEngine('test-scope', {
    runTasks: () => {
      calls += 1;
      return Promise.resolve();
    },
  });
  engine.start();
  await flush();
  assert.equal(calls, 1);
  engine.stop();
  engine.start();
  await flush();
  assert.equal(calls, 2, 'restart triggers a fresh initial run');
  engine.stop();
});

test('per-account isolation: two scopes never share scheduling or state', async () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  let aCalls = 0;
  let bCalls = 0;
  const engineA = createSyncEngine(
    'account-A',
    {
      runTasks: () => {
        aCalls += 1;
        throw new Error('A failing');
      },
    },
    { jitterRatio: 0 }
  );
  const engineB = createSyncEngine('account-B', {
    runTasks: () => {
      bCalls += 1;
      return Promise.resolve();
    },
  });

  engineA.start();
  await flush();
  assert.equal(engineA.getStatus().phase, 'cooldown', 'A is backing off');
  assert.equal(engineB.getStatus().phase, 'idle', 'B untouched by A failure');
  assert.equal(bCalls, 0, "B's tasks never ran because of A");

  engineB.start();
  await flush();
  assert.equal(bCalls, 1, 'B runs independently');

  // Stopping A must not affect B's engine.
  engineA.stop();
  assert.equal(engineA.getStatus().phase, 'idle');
  const bStillIdle = engineB.getStatus().phase;
  engineB.requestSync();
  await flush();
  assert.equal(bCalls, 2, 'B still fully operational after A stops');
  assert.equal(bStillIdle, 'idle');

  await advance(20000);
  assert.equal(aCalls, 1, "A's stopped timers never fire into B's session");
  assert.equal(bCalls, 2);
  engineB.stop();
  Math.random = originalRandom;
});

test('getStatus returns a snapshot copy, not a live reference', () => {
  const { engine } = makeSuccessEngine();
  const snap = engine.getStatus();
  snap.phase = 'cooldown';
  assert.notEqual(engine.getStatus().phase, 'cooldown', 'mutating the snapshot is safe');
});

test('scopeKey is exposed for per-account identification', () => {
  const { engine } = makeSuccessEngine();
  assert.equal(engine.scopeKey, 'test-scope');
});

test('periodic catch-up: an idle tab keeps running a scheduled sync on the interval', async () => {
  const { engine, calls } = makeSuccessEngine({ periodicIntervalMs: 100 });
  engine.start();
  await flush();
  assert.equal(calls(), 1, 'initial run');

  await advance(100);
  assert.equal(calls(), 2, 'periodic scheduled run after one interval');
  await advance(100);
  assert.equal(calls(), 3, 'periodic keeps ticking while started');
  engine.stop();
  await advance(200);
  assert.equal(calls(), 3, 'no periodic tick after stop()');
});

test('periodic catch-up does not defeat a backoff cooldown', async () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  let calls = 0;
  const engine = createSyncEngine(
    'test-scope-cooldown',
    {
      runTasks: () => {
        calls += 1;
        throw new Error('boom');
      },
    },
    { jitterRatio: 0, periodicIntervalMs: 50 }
  );

  engine.start();
  await flush();
  assert.equal(calls, 1);
  assert.equal(engine.getStatus().phase, 'cooldown');

  // Several periodic intervals elapse while cooldown is active — the retry
  // staircase (first retry at 2s) must be the ONLY thing to fire.
  await advance(1000);
  assert.equal(calls, 1, 'periodic tick suppressed during cooldown');
  engine.stop();
  Math.random = originalRandom;
});

test('periodic catch-up is skipped while offline and resumes on reconnect', async () => {
  let calls = 0;
  const engine = createSyncEngine(
    'test-scope-offline-periodic',
    {
      runTasks: () => {
        calls += 1;
        return Promise.resolve();
      },
    },
    { periodicIntervalMs: 50 }
  );

  setOnline(false);
  engine.start();
  await flush();
  assert.equal(calls, 0, 'offline start does not run');

  await advance(100);
  assert.equal(calls, 0, 'periodic tick skipped while offline');

  setOnline(true);
  g.window.dispatch('online');
  await flush();
  assert.equal(calls, 1, 'reconnect run fires');
  engine.stop();
});

test('broadcast: a successful sync wakes sibling tabs for the same scope', async () => {
  let aCalls = 0;
  let bCalls = 0;
  const engineA = createSyncEngine('test-scope-bc', {
    runTasks: () => {
      aCalls += 1;
      return Promise.resolve();
    },
  });
  const engineB = createSyncEngine('test-scope-bc', {
    runTasks: () => {
      bCalls += 1;
      return Promise.resolve();
    },
  });

  engineB.start();
  await flush();
  assert.equal(bCalls, 1, 'tab B initial sync');

  // Tab A runs and succeeds → posts a broadcast that B answers once.
  engineA.start();
  await flush();
  assert.equal(aCalls, 1, 'tab A initial sync');

  // Broadcast delivery is asynchronous (setImmediate stays unmocked while
  // setTimeout is clock-mocked, so flush() a few turns for delivery).
  for (let i = 0; i < 5; i++) await flush();
  assert.equal(bCalls, 2, 'tab B answered the sibling wake-up');

  // The broadcast-triggered run must NOT re-broadcast (no ping-pong).
  for (let i = 0; i < 5; i++) await flush();
  assert.equal(aCalls, 1, 'tab A did not run again from its own broadcast');
  assert.equal(bCalls, 2, 'tab B did not cascade another broadcast back');

  engineA.stop();
  engineB.stop();
});

test('broadcast is per-scope — a different account is never woken', async () => {
  let bCalls = 0;
  const engineA = createSyncEngine('test-scope-bc-a', {
    runTasks: () => Promise.resolve(),
  });
  const engineB = createSyncEngine('test-scope-bc-b', {
    runTasks: () => {
      bCalls += 1;
      return Promise.resolve();
    },
  });

  engineB.start();
  engineA.start();
  await flush();
  for (let i = 0; i < 5; i++) await flush();
  assert.equal(bCalls, 1, 'tab B only ran its own initial sync, never A broadcast');
  engineA.stop();
  engineB.stop();
});