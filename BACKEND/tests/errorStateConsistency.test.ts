import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiErrorBody } from '../src/routes/ai';

// Day 10 Task 3 — API error-state consistency:
//  1. An upstream Groq 429 must surface as a real 429 ("busy"), never a 500, so
//     the client classifier shows a rate-limit message instead of a server error.
//  2. The misconfigured 503 ("AI not configured") is preserved.
//  3. Everything else stays a 500 so a genuine outage is never masked as a 4xx.

test('upstream Groq 429 is mapped to a real 429 rate-limit response', () => {
  const { status, body } = aiErrorBody({ status: 429 }, 'AI chat failed');
  assert.equal(status, 429);
  assert.equal(body.success, false);
  assert.ok(body.error.toLowerCase().includes('busy'));
});

test('AI-not-configured 503 stays explicit', () => {
  const { status, body } = aiErrorBody({ status: 503 }, 'AI chat failed');
  assert.equal(status, 503);
  assert.ok(body.error.toLowerCase().includes('not configured'));
});

test('unknown failures remain a generic 500', () => {
  const { status } = aiErrorBody(new Error('boom'), 'AI chat failed');
  assert.equal(status, 500);
});

test('an upstream 4xx without a recognized status stays a 500, never a 2xx', () => {
  // A 400 from the provider is a transient upstream condition for THIS user's
  // request; collapsing to 500 keeps the client from misreading it as a
  // badRequest caused by the user.
  const { status } = aiErrorBody({ status: 400 }, 'AI chat failed');
  assert.equal(status, 500);
});