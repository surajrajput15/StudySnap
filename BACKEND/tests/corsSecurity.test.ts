import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isOriginAllowed,
  normalizeOrigin,
  CORS_EXPOSED_HEADERS,
  isVercelPreviewOrigin,
} from '../src/middleware/security';

const PROD_ALLOWED = ['https://studysnap-sigma.vercel.app', 'https://studysnap.vercel.app'];
const DEV_ALLOWED = ['http://localhost:3000', 'http://127.0.0.1:3000'];

test('normalizeOrigin strips trailing slash and path', () => {
  assert.equal(normalizeOrigin('https://studysnap-sigma.vercel.app/'), 'https://studysnap-sigma.vercel.app');
  assert.equal(normalizeOrigin('https://evil.com/?origin=studysnap-sigma.vercel.app'), 'https://evil.com');
});

test('exact production origin is allowed', () => {
  assert.equal(isOriginAllowed('https://studysnap-sigma.vercel.app', PROD_ALLOWED), true);
  assert.equal(isOriginAllowed('https://studysnap-sigma.vercel.app/', PROD_ALLOWED), true);
});

test('localhost look-alike origins are rejected in production', () => {
  assert.equal(isOriginAllowed('https://localhost.evil.com', PROD_ALLOWED), false);
  assert.equal(isOriginAllowed('http://localhost.evil.com', PROD_ALLOWED), false);
  assert.equal(isOriginAllowed('https://evil-localhost.com', PROD_ALLOWED), false);
  assert.equal(isOriginAllowed('https://evil-localhost.example.com', PROD_ALLOWED), false);
  assert.equal(isOriginAllowed('https://127.0.0.1.evil.com', PROD_ALLOWED), false);
  assert.equal(isOriginAllowed('https://studysnap-sigma.vercel.app.evil.com', PROD_ALLOWED), false);
  assert.equal(isOriginAllowed('https://evil.com/?origin=studysnap-sigma.vercel.app', PROD_ALLOWED), false);
});

test('plain localhost origins are also rejected in production', () => {
  assert.equal(isOriginAllowed('http://localhost:3000', PROD_ALLOWED), false);
  assert.equal(isOriginAllowed('http://127.0.0.1:3000', PROD_ALLOWED), false);
});

test('legitimate local development origins are allowed in dev', () => {
  assert.equal(isOriginAllowed('http://localhost:3000', DEV_ALLOWED), true);
  assert.equal(isOriginAllowed('http://127.0.0.1:3000', DEV_ALLOWED), true);
});

test('partial-host and suffix matching is impossible', () => {
  assert.equal(isOriginAllowed('https://vercel.app', PROD_ALLOWED), false);
  assert.equal(isOriginAllowed('https://sigma.vercel.app', PROD_ALLOWED), false);
  assert.equal(isOriginAllowed('https://studysnap-sigma.vercel.app.attacker.test', PROD_ALLOWED), false);
  assert.equal(isOriginAllowed('https://attacker.test/studysnap-sigma.vercel.app', PROD_ALLOWED), false);
});

test('Vercel PR/preview origins are recognized only for real .vercel.app hosts', () => {
  assert.equal(isVercelPreviewOrigin('https://studysnap-sigma-git-feature-abc.vercel.app'), true);
  assert.equal(isVercelPreviewOrigin('https://anyproject.vercel.app'), true);
  assert.equal(isVercelPreviewOrigin('https://vercel.app'), true);
  assert.equal(isVercelPreviewOrigin('https://studysnap-sigma.vercel.app'), true);
  // Non-vercel hosts and spoofs must never match.
  assert.equal(isVercelPreviewOrigin('https://vercel.app.evil.com'), false);
  assert.equal(isVercelPreviewOrigin('https://evilvercel.app'), false);
  assert.equal(isVercelPreviewOrigin('http://localhost:3000'), false);
  assert.equal(isVercelPreviewOrigin('https://evil.com'), false);
});

test('CORS exposes exactly the rate-limit headers the server actually emits', () => {
  // The limiter runs with standardHeaders: true (draft-6: RateLimit-Policy /
  // RateLimit-Limit / RateLimit-Remaining / RateLimit-Reset) and legacyHeaders:
  // false (no X-RateLimit-*). Retry-After is only readable by browsers when
  // explicitly exposed, so the frontend apiFetch → syncEngine backoff chain.
  assert.ok(CORS_EXPOSED_HEADERS.includes('Retry-After'), 'Retry-After must be readable by browsers');
  assert.ok(CORS_EXPOSED_HEADERS.includes('RateLimit-Limit'));
  assert.ok(CORS_EXPOSED_HEADERS.includes('RateLimit-Remaining'));
  assert.ok(CORS_EXPOSED_HEADERS.includes('RateLimit-Reset'));
  assert.ok(
    !CORS_EXPOSED_HEADERS.some((h) => h.startsWith('X-RateLimit-')),
    'legacy X-RateLimit-* headers are disabled on the server and must not be exposed'
  );
});
