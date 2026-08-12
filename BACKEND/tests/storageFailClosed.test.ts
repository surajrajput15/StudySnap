import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// Cloudinary config is captured at storage.ts module load, so the service is
// loaded FRESH in a `before` hook with every credential forced to an empty
// string. dotenv never overrides an already-set variable, so a local .env with
// real credentials cannot re-seed the module and the service stays unconfigured
// for the whole file — exactly the "call-time fail-closed" behavior the plan
// requires (the boot validator must NOT block on these).

interface StorageService {
  isStorageConfigured: () => boolean;
  buildVoiceAudioPublicId: (userId: string, voiceNoteId: string) => string;
  uploadVoiceAudio: (audioBuffer: Buffer, publicId: string) => Promise<unknown>;
  destroyVoiceAudio: (publicId: string) => Promise<unknown>;
  StorageConfigurationError: typeof Error;
}

let storage!: StorageService;
const CLOUDINARY_KEYS = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const;

before(async () => {
  const saved = new Map(CLOUDINARY_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of CLOUDINARY_KEYS) process.env[key] = '';
    storage = (await import(`../src/services/storage.ts?failclosed=${Date.now()}${Math.random()}`)) as unknown as StorageService;
  } finally {
    for (const key of CLOUDINARY_KEYS) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('isStorageConfigured() reports false when Cloudinary is not configured', () => {
  assert.equal(storage.isStorageConfigured(), false);
});

test('uploadVoiceAudio rejects with a StorageConfigurationError (fail-closed)', async () => {
  await assert.rejects(storage.uploadVoiceAudio(Buffer.from('fake-audio-bytes'), 'voice/user1/vn1'), (err: unknown) => {
    const e = err as Error;
    return e instanceof storage.StorageConfigurationError && e.name === 'StorageConfigurationError' && e.message.includes('Cloudinary');
  });
});

test('destroyVoiceAudio rejects with a StorageConfigurationError (fail-closed)', async () => {
  await assert.rejects(storage.destroyVoiceAudio('voice/user1/vn1'), (err: unknown) => {
    const e = err as Error;
    return e instanceof storage.StorageConfigurationError && e.name === 'StorageConfigurationError';
  });
});

test('fail-closed takes precedence even over payload validation', async () => {
  // assertConfigured() runs before any payload check, so an unconfigured
  // service must reject EVERY upload/destroy with StorageConfigurationError —
  // including payloads that would otherwise be type errors.
  await assert.rejects(storage.uploadVoiceAudio(Buffer.alloc(0), 'voice/user1/vn1'), (err: unknown) => err instanceof storage.StorageConfigurationError);
  await assert.rejects(storage.uploadVoiceAudio(Buffer.from('x'), ''), (err: unknown) => err instanceof storage.StorageConfigurationError);
  await assert.rejects(storage.destroyVoiceAudio(''), (err: unknown) => err instanceof storage.StorageConfigurationError);
});

test('pure id-building validation is independent of Cloudinary config', () => {
  assert.equal(storage.buildVoiceAudioPublicId('user1', 'vn1'), 'voice/user1/vn1');
  assert.throws(() => storage.buildVoiceAudioPublicId('', 'vn1'), TypeError);
  assert.throws(() => storage.buildVoiceAudioPublicId('user1', 'evil/path'), TypeError);
});