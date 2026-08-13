import type {
  AiChatMessage,
  Category,
  Folder,
  Note,
  RevisionLog,
  VoiceNote,
} from './store/useStore.ts';

// Day 9 Task 16 — guest → signed-in data migration.
//
// Before sign-in the app persists everything under the anonymous scope key
// (`studysnap-store`, no user suffix). When a guest finally signs in, that data
// would otherwise be orphaned forever. These helpers are pure so the migration
// can be unit-tested; `migrateGuestDataForUser` in useStore.ts performs the
// actual localStorage move and clears the guest scope so it never re-imports.

export interface GuestMigrationData {
  notes: Note[];
  voiceNotes: VoiceNote[];
  categories: Category[];
  folders: Folder[];
  revisionLogs: RevisionLog[];
  coins: number;
  earnedAchievements: string[];
}

/** What was carried into the account, shown to the user in the notice. */
export interface GuestMigrationResult {
  notes: number;
  voiceNotes: number;
  folders: number;
  revisionLogs: number;
  coins: number;
}

function emptyGuest(): GuestMigrationData {
  return {
    notes: [],
    voiceNotes: [],
    categories: [],
    folders: [],
    revisionLogs: [],
    coins: 0,
    earnedAchievements: [],
  };
}

/** Merge by stable id — target wins, incoming records are appended if new. */
export function mergeById<T extends { id: string }>(target: T[], incoming: T[]): T[] {
  const seen = new Set(target.map((item) => item.id));
  const merged = target.slice();
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      merged.push(item);
      seen.add(item.id);
    }
  }
  return merged;
}

/**
 * Day 10 Task 2 — backward-compat normalization for a single persisted voice
 * note. Extracted from the store's persist `merge` so EVERY load path applies
 * the same rules: first hydration (persist merge), account switching
 * (`switchStoreScopeForUser`), and guest→account migration. Previously the
 * scope-switch and migration paths spread raw persisted rows, so legacy
 * records (empty-string `noteId`, missing `updatedAt`, dead blob `audioUrl`)
 * entered the live store unnormalized and LWW reconciliation broke.
 */
export function normalizeVoiceNote(raw: unknown): VoiceNote {
  const vn = (raw ?? {}) as Partial<VoiceNote> & { audioUrl?: string };
  const createdAt = typeof vn.createdAt === 'string' ? vn.createdAt : new Date().toISOString();
  const hasAudioId = 'audioId' in vn;
  const legacy = !hasAudioId && typeof vn.audioUrl === 'string';
  const normalized: VoiceNote = {
    id: typeof vn.id === 'string' && vn.id ? vn.id : crypto.randomUUID(),
    noteId: vn.noteId === '' ? null : vn.noteId ?? null,
    audioId: legacy ? null : vn.audioId ?? null,
    audioUrl: legacy ? null : typeof vn.audioUrl === 'string' ? vn.audioUrl : null,
    synced: !legacy && typeof vn.synced === 'boolean' ? vn.synced : false,
    updatedAt: typeof vn.updatedAt === 'string' ? vn.updatedAt : createdAt,
    duration: typeof vn.duration === 'number' && Number.isFinite(vn.duration) ? vn.duration : 0,
    transcript: typeof vn.transcript === 'string' ? vn.transcript : null,
    createdAt,
  };
  if (legacy) normalized.legacyAudioUrl = vn.audioUrl;
  return normalized;
}

/** Day 10 Task 2 — drops malformed/legacy persisted chat rows. */
export function normalizeAiMessages(input: unknown): AiChatMessage[] {
  if (!Array.isArray(input)) return [];
  return (input as Partial<AiChatMessage>[]).filter(
    (m): m is AiChatMessage =>
      !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  );
}

/** Normalizes a parsed guest payload (guarding missing/legacy fields). */
export function normalizeGuestData(input: Partial<GuestMigrationData> | null | undefined): GuestMigrationData {
  if (!input || typeof input !== 'object') return emptyGuest();
  return {
    notes: Array.isArray(input.notes) ? input.notes : [],
    voiceNotes: Array.isArray(input.voiceNotes) ? input.voiceNotes.map(normalizeVoiceNote) : [],
    categories: Array.isArray(input.categories) ? input.categories : [],
    folders: Array.isArray(input.folders) ? input.folders : [],
    revisionLogs: Array.isArray(input.revisionLogs) ? input.revisionLogs : [],
    coins: typeof input.coins === 'number' && Number.isFinite(input.coins) ? input.coins : 0,
    earnedAchievements: Array.isArray(input.earnedAchievements) ? input.earnedAchievements : [],
  };
}

/** Returns null when the guest scope holds nothing worth migrating. */
export function summarizeGuestData(guest: GuestMigrationData): GuestMigrationResult | null {
  const result: GuestMigrationResult = {
    notes: guest.notes.length,
    voiceNotes: guest.voiceNotes.length,
    folders: guest.folders.length,
    revisionLogs: guest.revisionLogs.length,
    coins: guest.coins,
  };
  const hasData =
    result.notes > 0 ||
    result.voiceNotes > 0 ||
    result.folders > 0 ||
    result.revisionLogs > 0 ||
    result.coins > 0;
  return hasData ? result : null;
}

export interface UserMigrationTarget {
  notes: Note[];
  voiceNotes: VoiceNote[];
  categories: Category[];
  folders: Folder[];
  revisionLogs: RevisionLog[];
  coins: number;
  earnedAchievements: string[];
}

/** Fold guest data into the account's existing state (dedupe by id, sum coins). */
export function mergeGuestIntoUser(
  user: UserMigrationTarget,
  guestInput: Partial<GuestMigrationData> | null | undefined,
): { merged: UserMigrationTarget; result: GuestMigrationResult | null } {
  const guest = normalizeGuestData(guestInput);
  const result = summarizeGuestData(guest);
  if (!result) return { merged: user, result: null };

  return {
    merged: {
      notes: mergeById(user.notes, guest.notes),
      voiceNotes: mergeById(user.voiceNotes, guest.voiceNotes),
      categories: mergeById(user.categories, guest.categories),
      folders: mergeById(user.folders, guest.folders),
      revisionLogs: mergeById(user.revisionLogs, guest.revisionLogs),
      coins: user.coins + guest.coins,
      earnedAchievements: mergeById(
        user.earnedAchievements.map((id) => ({ id })),
        guest.earnedAchievements.map((id) => ({ id })),
      ).map((item) => item.id),
    },
    result,
  };
}