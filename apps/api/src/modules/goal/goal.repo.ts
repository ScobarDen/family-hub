import { and, asc, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { familyMembers, goalMovements, goals, members, type Db } from "@/common/db";

export type GoalRow = typeof goals.$inferSelect & { completedByName: string | null };

export type MovementRow = typeof goalMovements.$inferSelect & {
  memberName: string;
  recordedByName: string;
};

type GoalTarget = { familyId: string; goalId: string };

const owners = alias(members, "owners");
const recorders = alias(members, "recorders");

type Viewer = { familyId: string; memberId: string; goalId?: string };

// A Private Goal exists only for its owner; a goalId narrows the list to that one Goal.
async function listVisible(db: Db, { familyId, memberId, goalId }: Viewer): Promise<GoalRow[]> {
  const rows = await db
    .select({ goal: goals, completedByName: members.name })
    .from(goals)
    .leftJoin(members, eq(members.id, goals.completedBy))
    .where(
      and(
        eq(goals.familyId, familyId),
        or(eq(goals.visibility, "shared"), eq(goals.ownerMemberId, memberId)),
        goalId === undefined ? undefined : eq(goals.id, goalId),
      ),
    )
    .orderBy(asc(goals.createdAt))
    .all();

  return rows.map(({ goal, completedByName }) => ({ ...goal, completedByName }));
}

async function movementsOf(db: Db, familyId: string, goalIds: string[]): Promise<MovementRow[]> {
  if (goalIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ movement: goalMovements, memberName: owners.name, recordedByName: recorders.name })
    .from(goalMovements)
    .innerJoin(owners, eq(owners.id, goalMovements.memberId))
    .innerJoin(recorders, eq(recorders.id, goalMovements.createdBy))
    .where(and(eq(goalMovements.familyId, familyId), inArray(goalMovements.goalId, goalIds)))
    .orderBy(asc(goalMovements.date), asc(goalMovements.createdAt))
    .all();

  return rows.map(({ movement, memberName, recordedByName }) => ({
    ...movement,
    memberName,
    recordedByName,
  }));
}

function ofGoal({ familyId, goalId }: GoalTarget) {
  return and(eq(goals.familyId, familyId), eq(goals.id, goalId));
}

function ofMovement({ familyId, movementId }: { familyId: string; movementId: string }) {
  return and(eq(goalMovements.familyId, familyId), eq(goalMovements.id, movementId));
}

export function createGoalRepo(db: Db) {
  return {
    listVisible: async (viewer: Viewer) => listVisible(db, viewer),
    movementsOf: async (familyId: string, goalIds: string[]) => movementsOf(db, familyId, goalIds),

    async isInFamily(familyId: string, memberId: string): Promise<boolean> {
      const row = await db
        .select({ memberId: familyMembers.memberId })
        .from(familyMembers)
        .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.memberId, memberId)))
        .get();

      return row !== undefined;
    },
    async add(goal: typeof goals.$inferInsert): Promise<void> {
      await db.insert(goals).values(goal);
    },
    async update(target: GoalTarget, values: Partial<typeof goals.$inferInsert>): Promise<void> {
      await db.update(goals).set(values).where(ofGoal(target));
    },
    async addMovement(movement: typeof goalMovements.$inferInsert): Promise<void> {
      await db.insert(goalMovements).values(movement);
    },
    async updateMovement(
      target: { familyId: string; movementId: string },
      values: Partial<typeof goalMovements.$inferInsert>,
    ): Promise<void> {
      await db.update(goalMovements).set(values).where(ofMovement(target));
    },
    async deleteMovement(target: { familyId: string; movementId: string }): Promise<void> {
      await db.delete(goalMovements).where(ofMovement(target));
    },
  };
}

export type GoalRepo = ReturnType<typeof createGoalRepo>;
