import { pgTable, text, timestamp, boolean, integer, uuid, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
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
});

export const folders = pgTable('folders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

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
});

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
});
