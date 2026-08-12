import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiRequestLogMeta } from '../src/utils/aiLogging';

const SECRET = 'PRIVATE_STUDYSNAP_SECRET_123';

test('chat metadata carries message count, never message content', () => {
  const meta = aiRequestLogMeta({ messages: [{ role: 'user', content: SECRET }] });
  assert.equal(meta.messageCount, 1);
  assert.deepEqual(Object.keys(meta), ['messageCount']);
  assert.equal(JSON.stringify(meta).includes(SECRET), false);
});

test('note/translate metadata is length metadata only, never the text', () => {
  const content = `${SECRET} user notes`;
  const meta = aiRequestLogMeta({ title: SECRET, content });
  assert.equal(meta.titleLength, SECRET.length);
  assert.equal(meta.contentLength, content.length);
  assert.deepEqual(Object.keys(meta).sort(), ['contentLength', 'titleLength']);
  assert.equal(JSON.stringify(meta).includes(SECRET), false);
});

test('arbitrary or unknown body fields are never mirrored', () => {
  const meta = aiRequestLogMeta({ garbage: SECRET, transcript: SECRET, prompt: SECRET, note: SECRET });
  assert.deepEqual(meta, {});
});

test('messages array content can never leak via any key', () => {
  const meta = aiRequestLogMeta({ messages: [{ role: 'user', content: `${SECRET}q` }, { role: 'assistant', content: SECRET }] });
  assert.equal(meta.messageCount, 2);
  assert.equal(JSON.stringify(meta).includes(SECRET), false);
});

test('targetLanguage is emitted for known enums only', () => {
  assert.equal(aiRequestLogMeta({ targetLanguage: 'hindi' }).targetLanguage, 'hindi');
  assert.equal(aiRequestLogMeta({ targetLanguage: 'english' }).targetLanguage, 'english');
  const meta = aiRequestLogMeta({ targetLanguage: SECRET });
  assert.equal(meta.targetLanguage, undefined);
});