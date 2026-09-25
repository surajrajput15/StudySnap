import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voiceNoteUploadSchema, normalizeAudioMimeType, hasAudioSignature } from '../src/routes/voice-notes';

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

test('an over-long transcript is rejected at the wire cap (Phase 1 P1)', () => {
  // The Day 10 truncate-instead-of-reject rule existed because OUR client used
  // to send raw transcripts and a 400 wedged its sync retry loop. The client
  // now truncates to 50k before sending (both sides agree), so only abusive
  // direct-API callers can exceed the cap — and they get a 400 with no retry
  // loop behind them. The transform stays as a backstop.
  const parsed = voiceNoteUploadSchema.safeParse({
    id: UUID,
    noteId: '',
    transcript: 'a'.repeat(60_000),
  });
  assert.equal(parsed.success, false);
});

test('a transcript exactly at the cap is accepted', () => {
  const parsed = voiceNoteUploadSchema.safeParse({
    id: UUID,
    noteId: '',
    transcript: 'a'.repeat(50_000),
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.transcript!.length, 50_000);
  }
});

test('a transcript far beyond any realistic size is still rejected', () => {
  const parsed = voiceNoteUploadSchema.safeParse({
    id: UUID,
    noteId: '',
    transcript: 'x'.repeat(300_000),
  });
  assert.equal(parsed.success, false);
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

// Day 14 Task 5 — the declared MIME must match the file's real bytes, so a
// caller who labels arbitrary bytes `audio/webm` is rejected at the edge.
function signature(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

test('real container signatures validate', () => {
  assert.equal(hasAudioSignature(signature('1a45dfa3' + '00'.repeat(16)), 'audio/webm'), true);
  assert.equal(hasAudioSignature(signature('4f676753' + '00'.repeat(16)), 'audio/ogg'), true);
  assert.equal(hasAudioSignature(signature('52494646' + '00000000' + '57415645'), 'audio/wav'), true);
  assert.equal(hasAudioSignature(signature('00000018' + '66747970' + '4d344120'), 'audio/mp4'), true);
  assert.equal(hasAudioSignature(signature('fff30000' + '00'.repeat(16)), 'audio/mpeg'), true);
});

test('non-audio bytes are rejected for every declared container', () => {
  // An HTML page labelled audio/webm must fail.
  assert.equal(hasAudioSignature(Buffer.from('<!DOCTYPE html><html>...'), 'audio/webm'), false);
  assert.equal(hasAudioSignature(Buffer.from('MZ....executable....'), 'audio/webm'), false);
  assert.equal(hasAudioSignature(Buffer.from('{ "json": true } padded....'), 'audio/ogg'), false);
  assert.equal(hasAudioSignature(Buffer.from('PK\x03\x04' + 'zipfile....'), 'audio/wav'), false);
  assert.equal(hasAudioSignature(Buffer.from('not-an-mp4-container!!!!'), 'audio/mp4'), false);
  assert.equal(hasAudioSignature(Buffer.from('GIF89a' + '00'.repeat(16)), 'audio/mpeg'), false);
});

test('tiny buffers are always rejected', () => {
  assert.equal(hasAudioSignature(Buffer.from(''), 'audio/webm'), false);
  assert.equal(hasAudioSignature(Buffer.from('ab'), 'audio/wav'), false);
});
