import { and, asc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { familyMembers, members, plans, type Db } from "@/common/db";

export type PlanRow = typeof plans.$inferSelect & {
  assigneeName: string | null;
  completedByName: string | null;
};

export type PlanTree = { root: PlanRow; subplans: PlanRow[] };

type Completing = { familyId: string; planId: string; memberId: string; now: number };

const assignees = alias(members, "assignees");
const completers = alias(members, "completers");

async function selectWhere(db: Db, condition: SQL | undefined): Promise<PlanRow[]> {
  const rows = await db
    .select({ plan: plans, assigneeName: assignees.name, completedByName: completers.name })
    .from(plans)
    .leftJoin(assignees, eq(assignees.id, plans.assigneeMemberId))
    .leftJoin(completers, eq(completers.id, plans.completedBy))
    .where(condition)
    .orderBy(asc(plans.createdAt))
    .all();

  return rows.map(({ plan, assigneeName, completedByName }) => ({
    ...plan,
    assigneeName,
    completedByName,
  }));
}

function inFamily(familyId: string, condition: SQL | undefined) {
  return and(eq(plans.familyId, familyId), condition);
}

// A Private Plan exists only for its owner, its Subplans included.
async function listVisible(db: Db, familyId: string, memberId: string): Promise<PlanTree[]> {
  const roots = await selectWhere(
    db,
    inFamily(
      familyId,
      and(
        isNull(plans.parentId),
        or(eq(plans.visibility, "shared"), eq(plans.ownerMemberId, memberId)),
      ),
    ),
  );
  const subplans =
    roots.length === 0
      ? []
      : await selectWhere(
          db,
          inFamily(
            familyId,
            inArray(
              plans.parentId,
              roots.map(({ id }) => id),
            ),
          ),
        );

  return roots.map((root) => ({
    root,
    subplans: subplans.filter(({ parentId }) => parentId === root.id),
  }));
}

async function findTree(db: Db, familyId: string, planId: string): Promise<PlanTree | undefined> {
  const [root] = await selectWhere(
    db,
    inFamily(familyId, and(eq(plans.id, planId), isNull(plans.parentId))),
  );

  if (!root) {
    return undefined;
  }

  return { root, subplans: await selectWhere(db, inFamily(familyId, eq(plans.parentId, planId))) };
}

async function isInFamily(db: Db, familyId: string, memberId: string): Promise<boolean> {
  const row = await db
    .select({ memberId: familyMembers.memberId })
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.memberId, memberId)))
    .get();

  return row !== undefined;
}

// Completing a Plan by hand completes its open Subplans with it.
async function completeWithSubplans(
  db: Db,
  { familyId, planId, memberId, now }: Completing,
): Promise<void> {
  await db
    .update(plans)
    .set({ completedAt: now, completedBy: memberId, updatedAt: now })
    .where(
      inFamily(
        familyId,
        and(or(eq(plans.id, planId), eq(plans.parentId, planId)), isNull(plans.completedAt)),
      ),
    );
}

export function createPlanRepo(db: Db) {
  return {
    listVisible: async (familyId: string, memberId: string) => listVisible(db, familyId, memberId),
    findTree: async (familyId: string, planId: string) => findTree(db, familyId, planId),

    isInFamily: async (familyId: string, memberId: string) => isInFamily(db, familyId, memberId),

    async add(plan: typeof plans.$inferInsert): Promise<void> {
      await db.insert(plans).values(plan);
    },

    async update(
      familyId: string,
      planId: string,
      values: Partial<typeof plans.$inferInsert>,
    ): Promise<void> {
      await db
        .update(plans)
        .set(values)
        .where(inFamily(familyId, eq(plans.id, planId)));
    },

    async delete(familyId: string, planId: string): Promise<void> {
      await db.delete(plans).where(inFamily(familyId, eq(plans.id, planId)));
    },

    completeWithSubplans: async (completing: Completing) => completeWithSubplans(db, completing),
  };
}

export type PlanRepo = ReturnType<typeof createPlanRepo>;
