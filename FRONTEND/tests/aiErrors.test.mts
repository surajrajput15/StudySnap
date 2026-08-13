import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyAiError, aiErrorMessage, AI_ERROR_MESSAGES } from '../lib/aiErrors.ts';

// Day 9 Task 17 — SnapAI used to collapse every failure into a generic bubble
// (or leak raw backend text). The classifier must now tell apart offline,
// network, timeout, rate-limit, auth, server, badRequest and empty responses.

test('offline flag wins over everything else', () => {
  assert.equal(classifyAiError({ isOffline: true, status: 500 }), 'offline');
  assert.equal(classifyAiError({ isOffline: true, message: 'fetch failed' }), 'offline');
});

test('429 and Retry-After classify as rateLimited', () => {
  assert.equal(classifyAiError({ status: 429 }), 'rateLimited');
  assert.equal(classifyAiError({ retryAfterMs: 30000 }), 'rateLimited');
  assert.equal(classifyAiError({ message: 'You are rate limited' }), 'rateLimited');
  assert.equal(classifyAiError({ message: 'quota exceeded' }), 'rateLimited');
});

test('401 and expired-session text classify as auth', () => {
  assert.equal(classifyAiError({ status: 401 }), 'auth');
  assert.equal(classifyAiError({ message: 'Authentication required' }), 'auth');
  assert.equal(classifyAiError({ message: 'Invalid or expired session' }), 'auth');
});

test('5xx statuses classify as server', () => {
  assert.equal(classifyAiError({ status: 500 }), 'server');
  assert.equal(classifyAiError({ status: 503 }), 'server');
  assert.equal(classifyAiError({ message: 'Internal Server Error' }), 'server');
});

test('other 4xx statuses classify as badRequest', () => {
  assert.equal(classifyAiError({ status: 400 }), 'badRequest');
  assert.equal(classifyAiError({ status: 413 }), 'badRequest');
});

test('client timeout flags and text classify as timeout', () => {
  assert.equal(classifyAiError({ timedOut: true }), 'timeout');
  assert.equal(classifyAiError({ message: 'The request timed out.' }), 'timeout');
});

test('network text including CORS classifies as network', () => {
  assert.equal(classifyAiError({ message: 'Failed to fetch' }), 'network');
  assert.equal(classifyAiError({ message: 'NetworkError: Connection refused' }), 'network');
  assert.equal(classifyAiError({ message: 'Cross-Origin Resource Sharing' }), 'network');
  assert.equal(classifyAiError({ message: 'Could not reach the server.' }), 'network');
});

test('empty failure with no signal classifies as invalidResponse', () => {
  assert.equal(classifyAiError({}), 'invalidResponse');
});

test('unrecognised message still resolves to a safe generic kind', () => {
  assert.equal(classifyAiError({ message: 'something unexpected happened' }), 'generic');
});

test('aiErrorMessage returns the per-kind message', () => {
  for (const kind of ['offline', 'network', 'timeout', 'auth', 'server', 'badRequest', 'invalidResponse', 'generic'] as const) {
    assert.equal(aiErrorMessage(kind), AI_ERROR_MESSAGES[kind]);
  }
});

test('aiErrorMessage appends a concrete retry hint for rate limits', () => {
  const msg = aiErrorMessage('rateLimited', 125000);
  assert.match(msg, /about 125 seconds/);
  assert.equal(aiErrorMessage('rateLimited', 0), AI_ERROR_MESSAGES.rateLimited);
  assert.equal(aiErrorMessage('rateLimited', null), AI_ERROR_MESSAGES.rateLimited);
});

test('messages are distinct per cause', () => {
  const kinds = ['offline', 'network', 'timeout', 'rateLimited', 'server', 'badRequest', 'invalidResponse', 'generic'] as const;
  const messages = kinds.map((k) => aiErrorMessage(k));
  assert.equal(new Set(messages).size, messages.length);
});