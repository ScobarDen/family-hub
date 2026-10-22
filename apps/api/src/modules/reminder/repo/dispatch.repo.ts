import { and, asc, eq, inArray, isNull, like, lt, lte, notInArray, or } from "drizzle-orm";

import { familyMembers, reminderDispatch, type DispatchSource, type Db } from "@/common/db";

import { sourceIdOf } from "../reminder.lib.ts";

export type DispatchRow = typeof reminderDispatch.$inferSelect;

export type NewRow = {
  source: DispatchSource;
  sourceId: string;
  memberId: string;
  occurrence: string;
  nextFireAt: number;
};

export type HolderRows = { familyId: string; sources: DispatchSource[]; holderId: string };

type DispatchValues = Partial<typeof reminderDispatch.$inferInsert>;

type SourceRows = { familyId: string; source: DispatchSource; sourceId: string };

export type MovedRow = Pick<DispatchRow, "id" | "occurrence" | "nextFireAt">;

// One statement per row, as D1 caps the bound parameters of a single statement.
export type DispatchChanges = {
  familyId: string;
  now: number;
  added: NewRow[];
  moved: MovedRow[];
  removedIds: string[];
};

const lockMs = 60_000;

function isUnlocked(now: number) {
  return or(isNull(reminderDispatch.lockedUntil), lt(reminderDispatch.lockedUntil, now));
}

function ofHolder({ familyId, sources, holderId }: HolderRows) {
  return and(
    eq(reminderDispatch.familyId, familyId),
    inArray(reminderDispatch.source, sources),
    or(
      eq(reminderDispatch.sourceId, holderId),
      like(reminderDispatch.sourceId, sourceIdOf(holderId, "%")),
    ),
  );
}

// Taking rows is one UPDATE over the due ones, so two ticks never send the same row twice.
async function claimDue(db: Db, { now, limit }: { now: number; limit: number }) {
  const due = db
    .select({ id: reminderDispatch.id })
    .from(reminderDispatch)
    .where(and(lte(reminderDispatch.nextFireAt, now), isUnlocked(now)))
    .orderBy(asc(reminderDispatch.nextFireAt))
    .limit(limit);

  return db
    .update(reminderDispatch)
    .set({ lockedUntil: now + lockMs })
    .where(and(inArray(reminderDispatch.id, due), isUnlocked(now)))
    .returning();
}

function insertOf(
  db: Db,
  { familyId, now }: { familyId: string; now: number },
  { row, id }: { row: NewRow; id: string },
) {
  return db
    .insert(reminderDispatch)
    .values({ id, familyId, ...row, createdAt: now, updatedAt: now });
}

// Only the rows that differ are written: D1 writes are the scarce resource.
async function write(
  db: Db,
  { familyId, now, added, moved, removedIds }: DispatchChanges,
  newId: () => string,
) {
  const statements = [
    ...added.map((row) => insertOf(db, { familyId, now }, { row, id: newId() })),
    ...moved.map(({ id, occurrence, nextFireAt }) =>
      db
        .update(reminderDispatch)
        .set({ occurrence, nextFireAt, updatedAt: now })
        .where(and(eq(reminderDispatch.familyId, familyId), eq(reminderDispatch.id, id))),
    ),
    ...(removedIds.length > 0
      ? [
          db
            .delete(reminderDispatch)
            .where(
              and(
                eq(reminderDispatch.familyId, familyId),
                inArray(reminderDispatch.id, removedIds),
              ),
            ),
        ]
      : []),
  ];
  const [first, ...rest] = statements;

  if (first !== undefined) {
    await db.batch([first, ...rest]);
  }
}

async function removeDeparted(db: Db, familyId: string): Promise<void> {
  const stayed = db
    .select({ memberId: familyMembers.memberId })
    .from(familyMembers)
    .where(eq(familyMembers.familyId, familyId));

  await db
    .delete(reminderDispatch)
    .where(
      and(eq(reminderDispatch.familyId, familyId), notInArray(reminderDispatch.memberId, stayed)),
    );
}

async function release(db: Db, dispatchIds: string[]): Promise<void> {
  if (dispatchIds.length > 0) {
    await db
      .update(reminderDispatch)
      .set({ lockedUntil: null })
      .where(inArray(reminderDispatch.id, dispatchIds));
  }
}

async function update(
  db: Db,
  { familyId, dispatchId }: { familyId: string; dispatchId: string },
  values: DispatchValues,
): Promise<void> {
  await db
    .update(reminderDispatch)
    .set(values)
    .where(and(eq(reminderDispatch.familyId, familyId), eq(reminderDispatch.id, dispatchId)));
}

export function createDispatchRepo(db: Db) {
  return {
    claimDue: async (claim: { now: number; limit: number }) => claimDue(db, claim),
    // A bot button names its row by id alone; the row names its Family.
    find: async (dispatchId: string): Promise<DispatchRow | undefined> =>
      db.select().from(reminderDispatch).where(eq(reminderDispatch.id, dispatchId)).get(),
    ofSource: async ({ familyId, source, sourceId }: SourceRows): Promise<DispatchRow[]> =>
      db
        .select()
        .from(reminderDispatch)
        .where(
          and(
            eq(reminderDispatch.familyId, familyId),
            eq(reminderDispatch.source, source),
            eq(reminderDispatch.sourceId, sourceId),
          ),
        )
        .all(),
    ofMember: async ({ familyId, memberId }: { familyId: string; memberId: string }) =>
      db
        .select()
        .from(reminderDispatch)
        .where(
          and(eq(reminderDispatch.familyId, familyId), eq(reminderDispatch.memberId, memberId)),
        )
        .all(),
    ofFamily: async (familyId: string): Promise<DispatchRow[]> =>
      db.select().from(reminderDispatch).where(eq(reminderDispatch.familyId, familyId)).all(),
    ofHolder: async (holder: HolderRows): Promise<DispatchRow[]> =>
      db.select().from(reminderDispatch).where(ofHolder(holder)).all(),
    write: async (changes: DispatchChanges, newId: () => string) => write(db, changes, newId),
    removeDeparted: async (familyId: string) => removeDeparted(db, familyId),
    // The rest of a claimed batch spans Families, as the claim did.
    release: async (dispatchIds: string[]) => release(db, dispatchIds),
    update: async (familyId: string, dispatchId: string, values: DispatchValues) =>
      update(db, { familyId, dispatchId }, values),
  };
}

export type DispatchRepo = ReturnType<typeof createDispatchRepo>;
