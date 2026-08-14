import { eq, and, type Column } from 'drizzle-orm';

// Day 14 Task 3 — extracted from the notes upsert so the cross-account guard is
// unit-testable. A caller-supplied note id must either belong to the caller
// ('owned'), be brand new ('free'), or be rejected ('taken') — it must never be
// INSERTed as if it were free when it already belongs to another account.
//
// The `where` helpers are kept structural (not typed to the real Drizzle query
// builder) so tests can pass a small fake DB with nothing but a chainable
// `select().from().where()`.

export type NoteAvailability = 'owned' | 'free' | 'taken';

interface QueryableDb {
  select: (cols?: unknown) => {
    from: (table: unknown) => {
      where: (cond: unknown) => Promise<Array<{ id?: string }>>;
    };
  };
}

export async function checkNoteIdAvailability(
  db: QueryableDb,
  notes: { id: Column; userId: Column },
  id: string,
  userId: string
): Promise<NoteAvailability> {
  const existing = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)));
  if (existing.length > 0) return 'owned';

  // The id is not the caller's — is it ANYONE's? If so it is taken and the
  // caller must not be allowed to INSERT it (a primary-key collision would
  // otherwise surface as an opaque DB error, and worse, could shadow the real
  // owner's row). `id` is the PK so at most one row matches; no `.limit()` is
  // needed.
  const taken = await db
    .select({ id: notes.id })
    .from(notes)
    .where(eq(notes.id, id));
  if (taken.length > 0) return 'taken';

  return 'free';
}