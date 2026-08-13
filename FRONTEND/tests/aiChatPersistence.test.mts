import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AiChatMessage } from '../lib/store/useStore.ts';
import { switchStoreScopeForUser, useStore } from '../lib/store/useStore.ts';

// Day 9 Task 7 — regression: the AI tutor conversation lived only in component
// state, so navigating away (unmount) or reloading wiped the chat. It is now
// persisted per user (role + content only — never transient streaming/error
// flags) and is isolated between accounts.

function makeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as Storage;
}

interface TestGlobal {
  window: { localStorage: Storage; dispatchEvent: () => boolean };
}

const g = globalThis as unknown as TestGlobal;

function persistedAiMessages(userId: string): AiChatMessage[] | undefined {
  const raw = g.window.localStorage.getItem(`studysnap-store:${userId}`);
  if (!raw) return undefined;
  const parsed = JSON.parse(raw) as { state?: { aiMessages?: AiChatMessage[] } };
  return parsed.state?.aiMessages;
}

beforeEach(() => {
  g.window = {
    localStorage: makeLocalStorage(),
    dispatchEvent: () => true,
  };
  switchStoreScopeForUser('userA');
});

test('setAiMessages stores the conversation in the store', () => {
  const chat: AiChatMessage[] = [
    { role: 'user', content: 'Explain quantum entanglement' },
    { role: 'assistant', content: 'Quantum entanglement is...' },
  ];

  useStore.getState().setAiMessages(chat);

  assert.deepEqual(useStore.getState().aiMessages, chat);
});

test('clearAiMessages resets the conversation', () => {
  useStore.getState().setAiMessages([{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello!' }]);

  useStore.getState().clearAiMessages();

  assert.deepEqual(useStore.getState().aiMessages, []);
});

test('The conversation is persisted to the user-scoped store', () => {
  useStore.getState().setAiMessages([
    { role: 'user', content: 'What is Newton law?' },
    { role: 'assistant', content: 'F = ma' },
  ]);

  const persisted = persistedAiMessages('userA');
  assert.ok(persisted, 'aiMessages written to userA storage');
  assert.deepEqual(persisted, [
    { role: 'user', content: 'What is Newton law?' },
    { role: 'assistant', content: 'F = ma' },
  ]);
});

test('Chat history is isolated per user and survives a scope round-trip', () => {
  useStore.getState().setAiMessages([{ role: 'user', content: 'Only for userA' }, { role: 'assistant', content: 'A-answer' }]);

  switchStoreScopeForUser('userB');
  assert.deepEqual(useStore.getState().aiMessages, [], 'userB never sees userA chat');

  useStore.getState().setAiMessages([{ role: 'user', content: 'Only for userB' }, { role: 'assistant', content: 'B-answer' }]);

  switchStoreScopeForUser('userA');
  assert.deepEqual(
    useStore.getState().aiMessages.map((m) => m.content),
    ['Only for userA', 'A-answer'],
    'userA chat restored after switching away',
  );

  switchStoreScopeForUser('userB');
  assert.deepEqual(
    useStore.getState().aiMessages.map((m) => m.content),
    ['Only for userB', 'B-answer'],
    'userB chat restored independently',
  );
});

test('Only durable role/content pairs are ever persisted', () => {
  const chat: AiChatMessage[] = [
    { role: 'user', content: 'A question' },
    { role: 'assistant', content: 'An answer' },
  ];

  useStore.getState().setAiMessages(chat);

  const persisted = persistedAiMessages('userA') as AiChatMessage[];
  for (const m of persisted) {
    assert.ok(m.role === 'user' || m.role === 'assistant');
    assert.equal(typeof m.content, 'string');
    assert.deepEqual(Object.keys(m).sort(), ['content', 'role'], 'no transient flags leak into storage');
  }
});