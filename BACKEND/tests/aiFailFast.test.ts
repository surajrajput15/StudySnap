import { test, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// The AI service caches `groq` at module load, so the whole service is loaded
// FRESH in a `before` hook with GROQ_API_KEY forced to an empty string. dotenv
// never overrides an already-set variable, so a local .env cannot re-seed the
// key and `groq` stays null for the entire file. The production guard reads
// NODE_ENV at CALL time, so it is toggled per test on the same instance.

type ChatMessage = { role: string; content: string };

interface AIService {
  chatCompletion: (messages: ChatMessage[]) => Promise<unknown>;
  summarizeNote: (title: string, content: string) => Promise<unknown>;
  generateMcqs: (title: string, content: string) => Promise<unknown>;
  generateFlashcards: (title: string, content: string) => Promise<unknown>;
  translateText: (content: string, lang: 'hindi' | 'english') => Promise<unknown>;
}

let ai!: AIService;
const savedNODE_ENV = process.env.NODE_ENV;
const savedGROQ = process.env.GROQ_API_KEY;

before(async () => {
  process.env.GROQ_API_KEY = '';
  ai = (await import(`../src/services/ai.ts?failfast=${Date.now()}${Math.random()}`)) as unknown as AIService;
  // Restore the key to its original state (the loaded instance keeps groq null).
  if (savedGROQ === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = savedGROQ;
});

afterEach(() => {
  if (savedNODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = savedNODE_ENV;
});

function is503Unavailable(err: unknown): boolean {
  const e = err as { name?: string; status?: number; message?: string };
  return e.name === 'AIUnavailableError' && e.status === 503 && (e.message ?? '').includes('GROQ_API_KEY');
}

test('production without GROQ_API_KEY throws an explicit 503 — never a mock', async () => {
  process.env.NODE_ENV = 'production';
  await assert.rejects(ai.chatCompletion([{ role: 'user', content: 'hello' }]), is503Unavailable);
  await assert.rejects(ai.summarizeNote('Title', 'Body'), is503Unavailable);
  await assert.rejects(ai.generateMcqs('Title', 'Body'), is503Unavailable);
  await assert.rejects(ai.generateFlashcards('Title', 'Body'), is503Unavailable);
  await assert.rejects(ai.translateText('Body', 'hindi'), is503Unavailable);
});

test('the 503 guard triggers for EVERY AI endpoint in production', async () => {
  process.env.NODE_ENV = 'production';
  const outcomes = await Promise.allSettled([
    ai.chatCompletion([{ role: 'user', content: 'world' }]),
    ai.summarizeNote('T', 'C'),
    ai.generateMcqs('T', 'C'),
    ai.generateFlashcards('T', 'C'),
    ai.translateText('C', 'english'),
  ]);
  for (const outcome of outcomes) {
    assert.equal(outcome.status, 'rejected', 'production without a key must never resolve');
    const e = (outcome as PromiseRejectedResult).reason;
    assert.ok(is503Unavailable(e), `expected 503 AIUnavailableError, got ${String((e as Error)?.name)}`);
  }
});

test('development without GROQ_API_KEY keeps the mock behavior', async () => {
  process.env.NODE_ENV = 'development';
  const reply = await ai.chatCompletion([{ role: 'user', content: 'hello' }]);
  assert.equal(typeof reply, 'string');
  assert.ok(String(reply).length > 0, 'mock chat returns content');

  const summary = await ai.summarizeNote('My Note', 'Body text');
  assert.ok(String(summary).includes('Summary'));

  const mcqs = await ai.generateMcqs('Title', 'Body');
  assert.ok(Array.isArray(mcqs) && mcqs.length > 0, 'dev mock MCQ generation works');
});

test('development mock translation is returned, never a 503', async () => {
  process.env.NODE_ENV = 'development';
  const translated = await ai.translateText('Hello world', 'hindi');
  assert.equal(typeof translated, 'string');
  assert.ok(String(translated).length > 0);
});