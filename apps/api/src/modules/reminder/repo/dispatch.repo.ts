import { and, asc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";

import { reminderDispatch, type Db } from "@/common/db";

export type DispatchRow = typeof reminderDispatch.$inferSelect;

export type DispatchPlan = { memberId: string; occurrence: string; nextFireAt: number };

type Source = { familyId: string; sourceId: string };

type Replacement = Source & { plans: DispatchPlan[]; now: number };

const lockMs = 60_000;

function isUnlocked(now: number) {
  return or(isNull(reminderDispatch.lockedUntil), lt(reminderDispatch.lockedUntil, now));
}

function ofReminder({ familyId, sourceId }: Source) {
  return and(
    eq(reminderDispatch.familyId, familyId),
    eq(reminderDispatch.source, "reminder"),
    eq(reminderDispatch.sourceId, sourceId),
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

// Only the rows of the changed source are rewritten: D1 writes are the scarce resource.
async function replace(db: Db, { plans, now, ...source }: Replacement, newId: () => string) {
  await db.batch([
    db.delete(reminderDispatch).where(ofReminder(source)),
    ...plans.map((plan) =>
      db.insert(reminderDispatch).values({
        id: newId(),
        ...source,
        source: "reminder",
        ...plan,
        createdAt: now,
        updatedAt: now,
      }),
    ),
  ] as const);
}

async function release(db: Db, dispatchIds: string[]): Promise<void> {
  if (dispatchIds.length > 0) {
    await db
      .update(reminderDispatch)
      .set({ lockedUntil: null })
      .where(inArray(reminderDispatch.id, dispatchIds));
  }
}

export function createDispatchRepo(db: Db) {
  return {
    claimDue: async (claim: { now: number; limit: number }) => claimDue(db, claim),
    find: async (dispatchId: string): Promise<DispatchRow | undefined> =>
      db.select().from(reminderDispatch).where(eq(reminderDispatch.id, dispatchId)).get(),
    ofSource: async (source: Source): Promise<DispatchRow[]> =>
      db.select().from(reminderDispatch).where(ofReminder(source)).all(),
    replace: async (replacement: Replacement, newId: () => string) =>
      replace(db, replacement, newId),
    release: async (dispatchIds: string[]) => release(db, dispatchIds),

    async update(dispatchId: string, values: Partial<typeof reminderDispatch.$inferInsert>) {
      await db.update(reminderDispatch).set(values).where(eq(reminderDispatch.id, dispatchId));
    },

    async deleteOfSource(source: Source): Promise<void> {
      await db.delete(reminderDispatch).where(ofReminder(source));
    },
  };
}

export type DispatchRepo = ReturnType<typeof createDispatchRepo>;
