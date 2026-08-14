import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeUncaughtError,
  describeUnhandledRejection,
  initClientCrashLogging,
  notifyError,
  ERROR_TOAST_EVENT,
} from '../lib/observability.ts';

type Handler = (event: unknown) => void;

const g = globalThis as unknown as {
  window?: {
    addEventListener: (t: string, h: Handler) => void;
    removeEventListener: (t: string, h: Handler) => void;
    dispatchEvent: (e: unknown) => boolean;
  };
};

function makeWindow() {
  const listeners = new Map<string, Set<Handler>>();
  const windowObj = {
    addEventListener: (t: string, h: Handler) => {
      if (!listeners.has(t)) listeners.set(t, new Set());
      listeners.get(t)!.add(h);
    },
    removeEventListener: (t: string, h: Handler) => {
      listeners.get(t)?.delete(h);
    },
    dispatchEvent: (e: unknown) => {
      const ev = e as { type: string };
      for (const h of listeners.get(ev.type) ?? []) h(ev);
      return true;
    },
  };
  return { windowObj, listeners };
}

test('describeUncaughtError formats message with location', () => {
  const event = { message: 'boom', filename: 'https://app/page.js', lineno: 12, colno: 3 } as ErrorEvent;
  assert.equal(describeUncaughtError(event), 'boom @ https://app/page.js:12:3');
});

test('describeUnhandledRejection surfaces Error stack when available', () => {
  const err = new Error('rejected');
  assert.match(describeUnhandledRejection(err), /rejected/);
});

test('describeUnhandledRejection stringifies non-Error rejections', () => {
  assert.equal(describeUnhandledRejection({ code: 42 }), 'Non-Error rejection: {"code":42}');
});

test('initClientCrashLogging registers and unregisters the three listeners', () => {
  const { windowObj, listeners } = makeWindow();
  g.window = windowObj;

  const unsubscribe = initClientCrashLogging();
  assert.equal(listeners.get('error')?.size, 1, 'uncaught-exception listener registered');
  assert.equal(listeners.get('unhandledrejection')?.size, 1, 'rejection listener registered');
  assert.equal(listeners.get('studysnap:crash')?.size, 1, 'declared-crash listener registered');

  unsubscribe();
  assert.equal(listeners.get('error')?.size, 0, 'uncaught-exception listener removed');
  assert.equal(listeners.get('unhandledrejection')?.size, 0, 'rejection listener removed');
  assert.equal(listeners.get('studysnap:crash')?.size, 0, 'declared-crash listener removed');
});

test('notifyError dispatches through the shared toast channel', () => {
  const { windowObj, listeners } = makeWindow();
  g.window = windowObj;
  const seen: string[] = [];
  listeners.set(ERROR_TOAST_EVENT, new Set([(e: unknown) => seen.push((e as { detail: { message: string } }).detail.message)]));

  notifyError('Microphone access was denied.');
  assert.deepEqual(seen, ['Microphone access was denied.']);
});