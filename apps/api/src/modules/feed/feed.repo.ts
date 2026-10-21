import { and, desc, eq, isNotNull, isNull, lte, or } from "drizzle-orm";

import {
  careEntries,
  events,
  familyMembers,
  goalMovements,
  goals,
  members,
  pets,
  plans,
  reminders,
  type Db,
} from "@/common/db";

export type FeedEventRow = typeof events.$inferSelect;
export type FeedReminderRow = typeof reminders.$inferSelect;
export type FeedPetRow = typeof pets.$inferSelect;
export type FeedPlanRow = typeof plans.$inferSelect & { completedByName: string | null };
export type FeedDueRow = Pick<
  typeof careEntries.$inferSelect,
  "id" | "petId" | "details" | "dueDate" | "dueKey"
>;
export type FeedCareRow = Pick<
  typeof careEntries.$inferSelect,
  "id" | "petId" | "details" | "createdAt"
> & { memberName: string };
export type FeedGoalRow = typeof goals.$inferSelect & { completedByName: string | null };
export type FeedMovementRow = Pick<
  typeof goalMovements.$inferSelect,
  "id" | "goalId" | "kind" | "amount" | "createdAt"
> & { memberName: string };
export type FeedJoinRow = { memberId: string; memberName: string; createdAt: number };

type Viewer = { familyId: string; memberId: string };

function isVisible(table: typeof events | typeof reminders, { familyId, memberId }: Viewer) {
  return and(
    eq(table.familyId, familyId),
    or(eq(table.visibility, "shared"), eq(table.ownerMemberId, memberId)),
  );
}

// Subplans carry no visibility of their own; the feed filters them by their root.
async function plansOf(db: Db, familyId: string): Promise<FeedPlanRow[]> {
  const rows = await db
    .select({ plan: plans, completedByName: members.name })
    .from(plans)
    .leftJoin(members, eq(members.id, plans.completedBy))
    .where(eq(plans.familyId, familyId))
    .all();

  return rows.map(({ plan, completedByName }) => ({ ...plan, completedByName }));
}

async function careBefore(
  db: Db,
  { familyId, before, limit }: { familyId: string; before: number; limit: number },
): Promise<FeedCareRow[]> {
  return db
    .select({
      id: careEntries.id,
      petId: careEntries.petId,
      details: careEntries.details,
      createdAt: careEntries.createdAt,
      memberName: members.name,
    })
    .from(careEntries)
    .innerJoin(members, eq(members.id, careEntries.createdBy))
    .where(and(eq(careEntries.familyId, familyId), lte(careEntries.createdAt, before)))
    .orderBy(desc(careEntries.createdAt), desc(careEntries.id))
    .limit(limit)
    .all();
}

// Newest first, so the first entry of each due key is the one that holds its Due Date.
async function duesOf(db: Db, familyId: string): Promise<FeedDueRow[]> {
  return db
    .select({
      id: careEntries.id,
      petId: careEntries.petId,
      details: careEntries.details,
      dueDate: careEntries.dueDate,
      dueKey: careEntries.dueKey,
    })
    .from(careEntries)
    .where(and(eq(careEntries.familyId, familyId), isNotNull(careEntries.dueKey)))
    .orderBy(desc(careEntries.occurredAt))
    .all();
}

async function joinsOf(db: Db, familyId: string): Promise<FeedJoinRow[]> {
  return db
    .select({
      memberId: familyMembers.memberId,
      memberName: members.name,
      createdAt: familyMembers.createdAt,
    })
    .from(familyMembers)
    .innerJoin(members, eq(members.id, familyMembers.memberId))
    .where(eq(familyMembers.familyId, familyId))
    .all();
}

async function goalsOf(db: Db, familyId: string): Promise<FeedGoalRow[]> {
  const rows = await db
    .select({ goal: goals, completedByName: members.name })
    .from(goals)
    .leftJoin(members, eq(members.id, goals.completedBy))
    .where(eq(goals.familyId, familyId))
    .all();

  return rows.map(({ goal, completedByName }) => ({ ...goal, completedByName }));
}

async function movementsOf(db: Db, familyId: string): Promise<FeedMovementRow[]> {
  return db
    .select({
      id: goalMovements.id,
      goalId: goalMovements.goalId,
      kind: goalMovements.kind,
      amount: goalMovements.amount,
      createdAt: goalMovements.createdAt,
      memberName: members.name,
    })
    .from(goalMovements)
    .innerJoin(members, eq(members.id, goalMovements.memberId))
    .where(eq(goalMovements.familyId, familyId))
    .all();
}

export function createFeedRepo(db: Db) {
  return {
    events: async (viewer: Viewer) =>
      db.select().from(events).where(isVisible(events, viewer)).all(),
    reminders: async (viewer: Viewer) =>
      db.select().from(reminders).where(isVisible(reminders, viewer)).all(),
    petsInCare: async (familyId: string) =>
      db
        .select()
        .from(pets)
        .where(and(eq(pets.familyId, familyId), isNull(pets.archivedAt)))
        .all(),
    petsOf: async (familyId: string) =>
      db.select().from(pets).where(eq(pets.familyId, familyId)).all(),
    plans: async (familyId: string) => plansOf(db, familyId),
    dues: async (familyId: string) => duesOf(db, familyId),
    careBefore: async (query: { familyId: string; before: number; limit: number }) =>
      careBefore(db, query),
    joins: async (familyId: string) => joinsOf(db, familyId),
    goals: async (familyId: string) => goalsOf(db, familyId),
    movements: async (familyId: string) => movementsOf(db, familyId),

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

export type FeedRepo = ReturnType<typeof createFeedRepo>;
