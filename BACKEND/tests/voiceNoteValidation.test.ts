import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voiceNoteUploadSchema, normalizeAudioMimeType } from '../src/routes/voice-notes';

// Day 10 Task 1 — the upload schema must accept standalone (unlinked) memos,
// which the frontend sends with `noteId: ''`. The old schema ran `.uuid()`
// before its `.transform`, so every standalone recording failed with a 400.

const UUID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
const OTHER_UUID = '1f3d3c2a-4e5b-4c6d-8e9f-0a1b2c3d4e5f';

test('standalone memo with empty-string noteId validates as null', () => {
  const parsed = voiceNoteUploadSchema.safeParse({ id: UUID, noteId: '' });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.noteId, null);
});

test('standalone memo with absent noteId validates as null', () => {
  const parsed = voiceNoteUploadSchema.safeParse({ id: UUID });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.noteId, null);
});

test('linked memo requires a valid UUID noteId', () => {
  const ok = voiceNoteUploadSchema.safeParse({ id: UUID, noteId: OTHER_UUID });
  assert.equal(ok.success, true);
  if (ok.success) assert.equal(ok.data.noteId, OTHER_UUID);

  const bad = voiceNoteUploadSchema.safeParse({ id: UUID, noteId: 'not-a-uuid' });
  assert.equal(bad.success, false);
});

test('transcript and duration are optional but bounded', () => {
  const parsed = voiceNoteUploadSchema.safeParse({ id: UUID, noteId: '', transcript: 'hello', duration: '12' });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.transcript, 'hello');
    assert.equal(parsed.data.duration, 12);
  }
});

test('MIME aliases normalize to the canonical container', () => {
  assert.equal(normalizeAudioMimeType('audio/webm'), 'audio/webm');
  assert.equal(normalizeAudioMimeType('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(normalizeAudioMimeType('audio/x-m4a'), 'audio/mp4');
  assert.equal(normalizeAudioMimeType('audio/aac'), 'audio/mp4');
  assert.equal(normalizeAudioMimeType('audio/x-mp4'), 'audio/mp4');
  assert.equal(normalizeAudioMimeType('audio/x-wav'), 'audio/wav');
  assert.equal(normalizeAudioMimeType('Audio/MPEG'), 'audio/mpeg');
  assert.equal(normalizeAudioMimeType('application/octet-stream'), 'application/octet-stream');
});
