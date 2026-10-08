import { pgTable, text, timestamp, boolean, integer, uuid, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  role: text('role').default('USER').notNull(),
  isSuspended: boolean('is_suspended').default(false).notNull(),
  college: text('college'),
  semester: text('semester'),
  studyGoals: text('study_goals'),
  streakCount: integer('streak_count').default(0).notNull(),
  lastActiveDate: timestamp('last_active_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  // Day 16 Task 2 — every categories query is user-scoped; without this index
  // the table would be scanned for each user.
  index('categories_user_idx').on(table.userId),
]);

export const folders = pgTable('folders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('folders_user_idx').on(table.userId),
]);

export const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  tags: text('tags'),
  isPinned: boolean('is_pinned').default(false).notNull(),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  pinLock: text('pin_lock'),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'cascade' }),
  lastRevisedAt: timestamp('last_revised_at'),
  nextRevisionAt: timestamp('next_revision_at'),
  revisionStreak: integer('revision_streak').default(0).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  // Day 16 Task 2 — the listing query filters by user + is_archived and
  // orders by updated_at DESC; the composite serves that scan. NOTE: the
  // ORDER BY also sorts is_pinned DESC, which is NOT in this key — pinned
  // ordering is computed as a filesort on the (already small, user-scoped)
  // result set, not served from the index.
  index('notes_user_archived_updated_idx').on(table.userId, table.isArchived, table.updatedAt),
]);

export const voiceNotes = pgTable('voice_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }),
  audioUrl: text('audio_url').notNull(),
  duration: integer('duration').notNull(),
  transcript: text('transcript'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  // User-scoped listing: WHERE user_id = ? ORDER BY created_at DESC
  index('voice_notes_user_created_idx').on(table.userId, table.createdAt),
]);

export const revisionLogs = pgTable('revision_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  revisedAt: timestamp('revised_at').defaultNow().notNull(),
  rating: text('rating'),
  nextScheduledAt: timestamp('next_scheduled_at').notNull(),
}, (table) => [
  // Day 16 Task 2 — revision rows are queried/cleaned per note.
  index('revision_logs_note_idx').on(table.noteId),
]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: text('actor_id').notNull(),
  actorEmail: text('actor_email'),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('audit_logs_actor_idx').on(table.actorId),
  index('audit_logs_created_idx').on(table.createdAt),
]);

export const featureFlags = pgTable('feature_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  featureKey: text('feature_key').unique().notNull(),
  name: text('name').notNull(),
  status: text('status').default('enabled').notNull(), // 'enabled' | 'maintenance' | 'disabled'
  description: text('description'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const aiRequestLogs = pgTable('ai_request_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id'),
  feature: text('feature').notNull(),
  model: text('model').notNull(),
  durationMs: integer('duration_ms').notNull(),
  inputChars: integer('input_chars').default(0).notNull(),
  outputChars: integer('output_chars').default(0).notNull(),
  success: boolean('success').default(true).notNull(),
  statusCode: integer('status_code').default(200).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('ai_request_logs_feature_idx').on(table.feature),
  index('ai_request_logs_created_idx').on(table.createdAt),
  index('ai_request_logs_user_idx').on(table.userId),
]);

export const quizzes = pgTable('quizzes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  questions: text('questions').notNull(), // JSON string
  totalQuestions: integer('total_questions').notNull(),
  bestScore: integer('best_score'),
  lastAttemptAt: timestamp('last_attempt_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('quizzes_user_idx').on(table.userId),
]);

export const flashcardDecks = pgTable('flashcard_decks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  cards: text('cards').notNull(), // JSON string
  cardCount: integer('card_count').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('flashcard_decks_user_idx').on(table.userId),
]);

export const mindMaps = pgTable('mind_maps', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  noteId: uuid('note_id').references(() => notes.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  data: text('data').notNull(), // JSON string
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('mind_maps_user_idx').on(table.userId),
]);

