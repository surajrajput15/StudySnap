import { v2 as cloudinary } from 'cloudinary';
import type { Readable } from 'node:stream';
import { env } from '../config/env';
import { VOICE_UPLOAD_TIMEOUT_MS, VOICE_DESTROY_TIMEOUT_MS } from '../config/constants';

/**
 * Day 8 Task 1 (Phase 1) — Cloudinary-backed durable storage for voice audio.
 *
 * Voice-note audio must survive device/site-data deletion, so the bytes live in
 * Cloudinary (object storage) rather than only the browser's IndexedDB. The
 * `voice_notes` DB row stores the secure URL returned here.
 *
 * Public IDs are server-generated (`voice/<userId>/<voiceNoteId>`) and are the
 * ONLY identifier used for upload/destroy. A client-provided filename is never
 * used as a public ID, and uploading again with the same public ID overwrites
 * the same asset, which makes retries idempotent.
 *
 * Configuration comes from the existing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY
 * / CLOUDINARY_API_SECRET env vars (see `src/config/env.ts`). The service fails
 * clearly when used without a valid configuration — it never silently falls back
 * to mock/local storage.
 *
 * Audio is uploaded with Cloudinary's `video` resource type (audio is stored
 * under the video resource in Cloudinary). The service is deliberately
 * independent of Express route logic: routes hand it a Buffer (multer memory
 * storage) plus a server-built public ID.
 */

const AUDIO_RESOURCE_TYPE = 'video' as const;

const isConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
} else {
  // Warn at load time so misconfiguration is visible, but do NOT throw here:
  // the backend must still boot when storage is unused. The wrappers below
  // throw StorageConfigurationError the moment they are actually called.
  console.warn(
    '[storage] ⚠️ Cloudinary is not configured (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / ' +
      'CLOUDINARY_API_SECRET). Voice-note audio upload/destroy will fail until configured.'
  );
}

/** Thrown when a storage operation is attempted without valid Cloudinary config. */
export class StorageConfigurationError extends Error {
  constructor() {
    super(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and ' +
        'CLOUDINARY_API_SECRET to enable voice-note audio storage.'
    );
    this.name = 'StorageConfigurationError';
  }
}

export interface VoiceAudioUploadResult {
  /** Server-generated Cloudinary public ID (`voice/<userId>/<voiceNoteId>`). */
  publicId: string;
  /** HTTPS delivery URL to store in the `voice_notes.audioUrl` column. */
  secureUrl: string;
}

/** True only when every required Cloudinary credential is present. */
export function isStorageConfigured(): boolean {
  return isConfigured;
}

/**
 * Builds the server-generated public ID for a voice note's audio.
 * Deterministic per (userId, voiceNoteId) so re-uploads overwrite the same asset.
 */
export function buildVoiceAudioPublicId(userId: string, voiceNoteId: string): string {
  if (!userId || typeof userId !== 'string') {
    throw new TypeError('[storage] userId must be a non-empty string');
  }
  if (!voiceNoteId || typeof voiceNoteId !== 'string' || voiceNoteId.includes('/')) {
    throw new TypeError('[storage] voiceNoteId must be a non-empty string without slashes');
  }
  return `voice/${userId}/${voiceNoteId}`;
}

/**
 * Uploads an in-memory audio buffer to Cloudinary under a server-generated
 * public ID. `overwrite: true` makes retries idempotent (a failed DB write after
 * a successful upload can safely re-upload with the same public ID).
 */
export async function uploadVoiceAudio(audioBuffer: Buffer, publicId: string): Promise<VoiceAudioUploadResult> {
  assertConfigured();
  if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
    throw new TypeError('[storage] audioBuffer must be a non-empty Buffer');
  }
  if (!publicId || typeof publicId !== 'string') {
    throw new TypeError('[storage] publicId must be a non-empty string');
  }

  const upload = new Promise<VoiceAudioUploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: AUDIO_RESOURCE_TYPE,
        overwrite: true,
        // The client filename is never used as (or reflected in) the public ID.
        use_filename: false,
        unique_filename: false,
        discard_original_filename: true,
      },
      (error, result) => {
        if (error) {
          reject(new Error(`[storage] Cloudinary audio upload failed: ${error.message}`, { cause: error }));
          return;
        }
        if (!result?.public_id || !result.secure_url) {
          reject(new Error('[storage] Cloudinary audio upload returned an empty result'));
          return;
        }
        resolve({ publicId: result.public_id, secureUrl: result.secure_url });
      }
    );
    stream.end(audioBuffer);
  });
  // Phase 1 P0: a hung upload previously pinned the Express handler (and its
  // 50MB buffer) forever. Prefer uploadVoiceAudioStream for request handling.
  return withTimeout(upload, VOICE_UPLOAD_TIMEOUT_MS, '[storage] Cloudinary audio upload timed out');
}

/**
 * Phase 1 P0: stream-based upload for disk-spooled multipart files. The file
 * never sits whole in the Node heap — multer writes to disk, this pipes the
 * file stream straight into Cloudinary. Same idempotency as the Buffer
 * wrapper. Rejects on Cloudinary error AND on timeout.
 */
export async function uploadVoiceAudioStream(audioStream: Readable, publicId: string): Promise<VoiceAudioUploadResult> {
  assertConfigured();
  if (!publicId || typeof publicId !== 'string') {
    throw new TypeError('[storage] publicId must be a non-empty string');
  }

  const upload = new Promise<VoiceAudioUploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: AUDIO_RESOURCE_TYPE,
        overwrite: true,
        // The client filename is never used as (or reflected in) the public ID.
        use_filename: false,
        unique_filename: false,
        discard_original_filename: true,
      },
      (error, result) => {
        if (error) {
          reject(new Error(`[storage] Cloudinary audio upload failed: ${error.message}`, { cause: error }));
          return;
        }
        if (!result?.public_id || !result?.secure_url) {
          reject(new Error('[storage] Cloudinary audio upload returned an empty result'));
          return;
        }
        resolve({ publicId: result.public_id, secureUrl: result.secure_url });
      }
    );
    audioStream.on('error', (err) => {
      try {
        (stream as unknown as { destroy?: () => void }).destroy?.();
      } catch { /* ignore */ }
      reject(err instanceof Error ? err : new Error('[storage] audio read stream failed'));
    });
    audioStream.pipe(stream);
  });

  return withTimeout(upload, VOICE_UPLOAD_TIMEOUT_MS, '[storage] Cloudinary audio upload timed out');
}

/**
 * Phase 1 P0: rejects if `promise` does not settle within `ms`. Used for
 * Cloudinary calls that previously had no timeout and could pin an Express
 * handler indefinitely.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/**
 * Deletes a Cloudinary asset by its public ID. Resolves true when the asset was
 * removed or was already absent (`not found` is treated as success so repeated
 * deletes are idempotent). Rejects when Cloudinary returns an error.
 */
export async function destroyVoiceAudio(publicId: string): Promise<boolean> {
  assertConfigured();
  if (!publicId || typeof publicId !== 'string') {
    throw new TypeError('[storage] publicId must be a non-empty string');
  }

  const destroy = new Promise<boolean>((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { resource_type: AUDIO_RESOURCE_TYPE },
      (error, result) => {
        if (error) {
          reject(new Error(`[storage] Cloudinary audio destroy failed: ${error.message}`, { cause: error }));
          return;
        }
        const status = result?.result;
        resolve(status === 'ok' || status === 'not found');
      }
    );
  });
  // Phase 1 P0: bound destroy latency the same way as uploads.
  return withTimeout(destroy, VOICE_DESTROY_TIMEOUT_MS, '[storage] Cloudinary audio destroy timed out');
}

function assertConfigured(): void {
  if (!isConfigured) {
    throw new StorageConfigurationError();
  }
}
