import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AddressInfo } from 'net';
import { apiLimiter, aiLimiter, voiceQueryLimiter, webhookLimiter } from '../src/middleware/rateLimiter';

// Day 14 Task 4 — rate-limit coverage. Every public surface must be throttled,
// and the high-cost surfaces (AI, voice, webhooks) must keep their OWN budgets
// instead of silently sharing the coarse global one.

let server: ReturnType<typeof express> extends never ? never : import('http').Server;

async function start(limiter: ReturnType<typeof express> extends never ? never : unknown, paths: string[]) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(limiter as express.RequestHandler);
  for (const p of paths) {
    app.get(p, (_req, res) => res.json({ ok: true }));
  }
  const srv = app.listen(0);
  await new Promise<void>((r) => srv.once('listening', r));
  const port = (srv.address() as AddressInfo).port;
  return { srv, base: `http://127.0.0.1:${port}` };
}

async function hit(base: string, path: string, ip: string): Promise<number> {
  const res = await fetch(`${base}${path}`, { headers: { 'x-forwarded-for': ip } });
  return res.status;
}

afterEach(() => {
  if (server) {
    server.close();
    server = undefined as unknown as typeof server;
  }
});

test('the global apiLimiter throttles /api/notes writes after 100/15min', async () => {
  const { srv, base } = await start(apiLimiter, ['/api/notes']);
  server = srv;
  const ip = '9.9.9.1';
  for (let i = 0; i < 100; i++) {
    assert.equal(await hit(base, '/api/notes', ip), 200, `request ${i + 1} within budget`);
  }
  assert.equal(await hit(base, '/api/notes', ip), 429, 'the 101st request is throttled');
});

test('the global apiLimiter never counts /api/ai requests (dedicated aiLimiter owns that budget)', async () => {
  const { srv, base } = await start(apiLimiter, ['/api/ai/chat']);
  server = srv;
  const ip = '9.9.9.2';
  for (let i = 0; i < 150; i++) {
    const status = await hit(base, '/api/ai/chat', ip);
    assert.equal(status, 200, `ai request ${i + 1} must skip the global budget`);
  }
});

test('the global apiLimiter never counts /api/voice-notes requests', async () => {
  const { srv, base } = await start(apiLimiter, ['/api/voice-notes']);
  server = srv;
  const ip = '9.9.9.3';
  for (let i = 0; i < 150; i++) {
    assert.equal(await hit(base, '/api/voice-notes', ip), 200);
  }
});

test('aiLimiter throttles AI calls at 20/min per IP', async () => {
  const { srv, base } = await start(aiLimiter, ['/api/ai/chat']);
  server = srv;
  const ip = '9.9.9.4';
  for (let i = 0; i < 20; i++) {
    assert.equal(await hit(base, '/api/ai/chat', ip), 200, `ai request ${i + 1}`);
  }
  assert.equal(await hit(base, '/api/ai/chat', ip), 429, 'the 21st AI call is throttled');
});

test('voiceQueryLimiter throttles hydration reads at 120/15min per IP', async () => {
  const { srv, base } = await start(voiceQueryLimiter, ['/api/voice-notes']);
  server = srv;
  const ip = '9.9.9.5';
  for (let i = 0; i < 120; i++) {
    assert.equal(await hit(base, '/api/voice-notes', ip), 200, `read ${i + 1}`);
  }
  assert.equal(await hit(base, '/api/voice-notes', ip), 429, 'the 121st read is throttled');
});

test('webhookLimiter throttles the unauthenticated webhook surface at 500/15min per IP', async () => {
  const { srv, base } = await start(webhookLimiter, ['/api/webhooks/clerk']);
  server = srv;
  const ip = '9.9.9.6';
  for (let i = 0; i < 500; i++) {
    const status = await hit(base, '/api/webhooks/clerk', ip);
    assert.equal(status, 200, `webhook ${i + 1}`);
  }
  assert.equal(await hit(base, '/api/webhooks/clerk', ip), 429, 'the 501st webhook is throttled');
});