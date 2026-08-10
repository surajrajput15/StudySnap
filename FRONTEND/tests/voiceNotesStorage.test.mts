import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveVoiceAudio,
  getVoiceAudio,
  deleteVoiceAudio,
  purgeOrphanedVoiceAudio,
  resetVoiceAudioStore,
  isVoiceRecordingScopeValid,
  finalizeVoiceNoteTranscript,
} from '../lib/storage/voiceNotes.ts';

async function blobText(blob: Blob | null): Promise<string> {
  if (!blob) return '';
  return blob.text();
}

beforeEach(async () => {
  // Isolate each case: wipe every stored blob, then open fresh.
  await purgeOrphanedVoiceAudio([]);
  await resetVoiceAudioStore();
});

test('saveVoiceAudio → getVoiceAudio round-trips the Blob', async () => {
  const blob = new Blob(['mem-1'], { type: 'audio/webm' });
  await saveVoiceAudio('id-1', blob);

  const retrieved = await getVoiceAudio('id-1');
  assert.ok(retrieved, 'blob should exist after save');
  assert.equal(retrieved.type, 'audio/webm');
  assert.equal(await blobText(retrieved), 'mem-1');
});

test('audio survives a simulated reload (fresh database connection)', async () => {
  await saveVoiceAudio('id-2', new Blob(['persisted'], { type: 'audio/webm' }));

  // A page reload = a new module instance with a brand-new connection to the
  // same IndexedDB backing store. resetVoiceAudioStore closes the cached
  // connection, exactly like a fresh page opening the database again.
  await resetVoiceAudioStore();

  const retrieved = await getVoiceAudio('id-2');
  assert.ok(retrieved, 'blob must survive reload');
  assert.equal(await blobText(retrieved), 'persisted');
});

test('deleteVoiceAudio removes the Blob', async () => {
  await saveVoiceAudio('id-3', new Blob(['doomed'], { type: 'audio/webm' }));
  await deleteVoiceAudio('id-3');

  const retrieved = await getVoiceAudio('id-3');
  assert.equal(retrieved, null, 'deleted audio must not resolve');
});

test('deleteVoiceAudio is idempotent for unknown ids', async () => {
  await assert.doesNotReject(() => deleteVoiceAudio('never-saved'));
});

test('getVoiceAudio returns null for a missing/unknown reference', async () => {
  const retrieved = await getVoiceAudio('missing-ref');
  assert.equal(retrieved, null);
});

test('purgeOrphanedVoiceAudio removes only ids outside the keep-set', async () => {
  await saveVoiceAudio('keep-a', new Blob(['a'], { type: 'audio/webm' }));
  await saveVoiceAudio('drop-b', new Blob(['b'], { type: 'audio/webm' }));
  await saveVoiceAudio('drop-c', new Blob(['c'], { type: 'audio/webm' }));

  const removed = await purgeOrphanedVoiceAudio(['keep-a']);

  assert.equal(removed, 2);
  assert.ok(await getVoiceAudio('keep-a'), 'kept id must remain');
  assert.equal(await getVoiceAudio('drop-b'), null, 'orphan must be removed');
  assert.equal(await getVoiceAudio('drop-c'), null, 'orphan must be removed');
});

test('stale recording scope is rejected', () => {
  // Same scope → valid.
  assert.equal(isVoiceRecordingScopeValid('studysnap-store:userA', 'studysnap-store:userA'), true);
  assert.equal(isVoiceRecordingScopeValid('studysnap-store', 'studysnap-store'), true);
  // Account switched → invalid.
  assert.equal(isVoiceRecordingScopeValid('studysnap-store:userA', 'studysnap-store:userB'), false);
  assert.equal(isVoiceRecordingScopeValid('studysnap-store:userA', 'studysnap-store'), false);
  // No captured scope → never valid (defensive default).
  assert.equal(isVoiceRecordingScopeValid(null, 'studysnap-store:userA'), false);
  assert.equal(isVoiceRecordingScopeValid('studysnap-store:userA', null), false);
});

test('final transcript is real text, never the placeholder when text exists', () => {
  assert.equal(finalizeVoiceNoteTranscript('  Hi there   '), 'Hi there');
  assert.equal(
    finalizeVoiceNoteTranscript('Voice note captured. extra words'),
    'Voice note captured. extra words',
  );
  // Genuinely no transcript → sensible empty/fallback value (null), never a
  // fabricated "captured" placeholder standing in for silence.
  assert.equal(finalizeVoiceNoteTranscript(''), null);
  assert.equal(finalizeVoiceNoteTranscript('   '), null);
  assert.equal(finalizeVoiceNoteTranscript(null), null);
  assert.equal(finalizeVoiceNoteTranscript(undefined), null);
});