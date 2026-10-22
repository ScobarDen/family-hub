import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";

import { bindFirst } from "@/common/bind";
import {
  careEntries,
  events,
  familyMembers,
  members,
  pets,
  plans,
  reminders,
  type Db,
} from "@/common/db";

export type EventRow = typeof events.$inferSelect;

export type PetRow = typeof pets.$inferSelect;

export type PlanRow = typeof plans.$inferSelect;

export type DigestRow = Pick<typeof members.$inferSelect, "isDigestEnabled" | "digestTime">;

type DueEntryRow = Pick<
  typeof careEntries.$inferSelect,
  "id" | "petId" | "details" | "dueDate" | "dueKey" | "occurredAt"
>;

type InFamily = { familyId: string; id: string };

export type FamilyHolderKind = "reminder" | "event" | "pet" | "plan";

type FamilyHolder = { kind: FamilyHolderKind; id: string };

async function dueEntriesOf(db: Db, { familyId, id }: InFamily): Promise<DueEntryRow[]> {
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
    .where(
      and(
        eq(careEntries.familyId, familyId),
        eq(careEntries.petId, id),
        isNotNull(careEntries.dueKey),
      ),
    )
    .orderBy(desc(careEntries.occurredAt), desc(sql`${careEntries}.rowid`))
    .all();
}

function heldBy(kind: FamilyHolderKind, rows: Array<{ id: string }>): FamilyHolder[] {
  return rows.map(({ id }) => ({ kind, id }));
}

// A digest belongs to its Member, not to the Family, so it is not among these.
async function holdersOf(db: Db, familyId: string): Promise<FamilyHolder[]> {
  const [reminderRows, eventRows, petRows, planRows] = await Promise.all([
    db.select({ id: reminders.id }).from(reminders).where(eq(reminders.familyId, familyId)).all(),
    db.select({ id: events.id }).from(events).where(eq(events.familyId, familyId)).all(),
    db.select({ id: pets.id }).from(pets).where(eq(pets.familyId, familyId)).all(),
    db
      .select({ id: plans.id })
      .from(plans)
      .where(and(eq(plans.familyId, familyId), isNull(plans.parentId)))
      .all(),
  ]);

  return [
    ...heldBy("reminder", reminderRows),
    ...heldBy("event", eventRows),
    ...heldBy("pet", petRows),
    ...heldBy("plan", planRows),
  ];
}

async function eventOf(db: Db, { familyId, id }: InFamily): Promise<EventRow | undefined> {
  return db
    .select()
    .from(events)
    .where(and(eq(events.familyId, familyId), eq(events.id, id)))
    .get();
}

async function petOf(db: Db, { familyId, id }: InFamily): Promise<PetRow | undefined> {
  return db
    .select()
    .from(pets)
    .where(and(eq(pets.familyId, familyId), eq(pets.id, id)))
    .get();
}

async function planTree(db: Db, { familyId, id }: InFamily): Promise<PlanRow[]> {
  return db
    .select()
    .from(plans)
    .where(and(eq(plans.familyId, familyId), or(eq(plans.id, id), eq(plans.parentId, id))))
    .all();
}

async function memberIdsOf(db: Db, familyId: string): Promise<string[]> {
  const rows = await db
    .select({ id: familyMembers.memberId })
    .from(familyMembers)
    .where(eq(familyMembers.familyId, familyId))
    .all();

  return rows.map(({ id }) => id);
}

export function createSourceRepo(db: Db) {
  return {
    ...bindFirst(db, {
      holdersOf,
      event: eventOf,
      pet: petOf,
      dueEntriesOf,
      planTree,
      memberIdsOf,
    }),

    // A Member's own settings and zone sit on their row, which belongs to no Family.
    digestOf: async (memberId: string): Promise<DigestRow | undefined> =>
      db
        .select({ isDigestEnabled: members.isDigestEnabled, digestTime: members.digestTime })
        .from(members)
        .where(eq(members.id, memberId))
        .get(),

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
