import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { requestLogger } from '../src/middleware/requestLogger';

// Day 15 Task 6 — the request logger must emit exactly one metric-only line per
// request and never log body content (even when a body is present).

function makeRes(statusCode: number) {
  const emitter = new EventEmitter();
  const res = emitter as EventEmitter & { statusCode: number };
  res.statusCode = statusCode;
  return res;
}

function capture(block: () => void): string[] {
  const lines: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (m: unknown) => lines.push(String(m));
  console.warn = (m: unknown) => lines.push(String(m));
  console.error = (m: unknown) => lines.push(String(m));
  try {
    block();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }
  return lines;
}

function runOnce(opts: { status: number; url: string; method?: string; userId?: string; body?: unknown }) {
  const req = {
    method: opts.method ?? 'GET',
    originalUrl: opts.url,
    userId: opts.userId,
    body: opts.body,
  } as Parameters<typeof requestLogger>[0];
  const res = makeRes(opts.status);
  let nextCalled = false;
  requestLogger(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true, 'next() must be called synchronously');
  res.emit('finish');
  return req._startTime;
}

test('requestLogger emits one metric-only line for a 2xx response', () => {
  const lines = capture(() => {
    const started = runOnce({ status: 200, url: '/api/notes', method: 'GET', userId: 'u1', body: { title: 'secret' } });
    assert.equal(typeof started, 'number', 'records a start timestamp');
  });
  assert.equal(lines.length, 1, 'exactly one log line');
  assert.match(lines[0], /^\[api\] ✓ GET \/api\/notes → 200 \d+ms userId=u1$/);
  assert.ok(!lines[0].includes('secret'), 'body content is never logged');
});

test('requestLogger warns for 4xx and errors for 5xx, omitting userId when absent', () => {
  const lines = capture(() => {
    runOnce({ status: 429, url: '/api/ai/chat' });
    runOnce({ status: 503, url: '/api/ai/chat', method: 'POST', userId: 'u2' });
  });
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^\[api\] ⚠ GET \/api\/ai\/chat → 429 \d+ms$/);
  assert.match(lines[1], /^\[api\] ✗ POST \/api\/ai\/chat → 503 \d+ms userId=u2$/);
});