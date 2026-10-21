import { and, desc, eq, isNotNull, or } from "drizzle-orm";

import { careEntries, events, familyMembers, members, pets, plans, type Db } from "@/common/db";

export type EventRow = typeof events.$inferSelect;

export type PetRow = typeof pets.$inferSelect;

export type PlanRow = typeof plans.$inferSelect;

export type DigestRow = Pick<typeof members.$inferSelect, "isDigestEnabled" | "digestTime">;

export type DueEntryRow = Pick<
  typeof careEntries.$inferSelect,
  "id" | "petId" | "details" | "dueDate" | "dueKey" | "occurredAt"
>;

async function dueEntriesOf(db: Db, petId: string): Promise<DueEntryRow[]> {
  return db
    .select({
      id: careEntries.id,
      petId: careEntries.petId,
      details: careEntries.details,
      dueDate: careEntries.dueDate,
      dueKey: careEntries.dueKey,
      occurredAt: careEntries.occurredAt,
    })
    .from(careEntries)
    .where(and(eq(careEntries.petId, petId), isNotNull(careEntries.dueKey)))
    .orderBy(desc(careEntries.occurredAt))
    .all();
}

// The cron and the bot buttons know a source by its id alone; each row names its Family.
export function createSourceRepo(db: Db) {
  return {
    event: async (eventId: string): Promise<EventRow | undefined> =>
      db.select().from(events).where(eq(events.id, eventId)).get(),

    pet: async (petId: string): Promise<PetRow | undefined> =>
      db.select().from(pets).where(eq(pets.id, petId)).get(),

    dueEntriesOf: async (petId: string) => dueEntriesOf(db, petId),

    planTree: async (planId: string): Promise<PlanRow[]> =>
      db
        .select()
        .from(plans)
        .where(or(eq(plans.id, planId), eq(plans.parentId, planId)))
        .all(),

    memberIdsOf: async (familyId: string): Promise<string[]> => {
      const rows = await db
        .select({ id: familyMembers.memberId })
        .from(familyMembers)
        .where(eq(familyMembers.familyId, familyId))
        .all();

      return rows.map(({ id }) => id);
    },

    digestOf: async (memberId: string): Promise<DigestRow | undefined> =>
      db
        .select({ isDigestEnabled: members.isDigestEnabled, digestTime: members.digestTime })
        .from(members)
        .where(eq(members.id, memberId))
        .get(),

    // A Member's own zone sits on their row, which belongs to no Family.
    async timeZoneOf(memberId: string): Promise<string | null> {
      const row = await db
        .select({ timeZone: members.timeZone })
        .from(members)
        .where(eq(members.id, memberId))
        .get();

      return row?.timeZone ?? null;
    },
  };
}

export type SourceRepo = ReturnType<typeof createSourceRepo>;
