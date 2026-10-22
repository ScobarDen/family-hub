import { and, asc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import {
  albumPhotos,
  albums,
  familyMembers,
  members,
  pets,
  photos,
  plans,
  type Db,
} from "@/common/db";

export type PlanRow = typeof plans.$inferSelect & {
  assigneeName: string | null;
  completedByName: string | null;
  petName: string | null;
};

export type PlanTree = { root: PlanRow; subplans: PlanRow[] };

type Completing = { familyId: string; planId: string; memberId: string; now: number };

const assignees = alias(members, "assignees");
const completers = alias(members, "completers");

async function selectWhere(db: Db, condition: SQL | undefined): Promise<PlanRow[]> {
  const rows = await db
    .select({
      plan: plans,
      assigneeName: assignees.name,
      completedByName: completers.name,
      petName: pets.name,
    })
    .from(plans)
    .leftJoin(assignees, eq(assignees.id, plans.assigneeMemberId))
    .leftJoin(completers, eq(completers.id, plans.completedBy))
    .leftJoin(pets, eq(pets.id, plans.petId))
    .where(condition)
    .orderBy(asc(plans.createdAt))
    .all();

  return rows.map(({ plan, assigneeName, completedByName, petName }) => ({
    ...plan,
    assigneeName,
    completedByName,
    petName,
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

async function hasPet(db: Db, familyId: string, petId: string): Promise<boolean> {
  const row = await db
    .select({ id: pets.id })
    .from(pets)
    .where(and(eq(pets.familyId, familyId), eq(pets.id, petId)))
    .get();

  return row !== undefined;
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

type PlanAlbumRow = {
  id: string;
  title: string;
  photos: Array<typeof photos.$inferSelect>;
};

async function albumOf(
  db: Db,
  { familyId, albumId }: { familyId: string; albumId: string },
): Promise<PlanAlbumRow | undefined> {
  const album = await db
    .select({ id: albums.id, title: albums.title })
    .from(albums)
    .where(and(eq(albums.familyId, familyId), eq(albums.id, albumId)))
    .get();

  if (!album) {
    return undefined;
  }

  const rows = await db
    .select({ photo: photos })
    .from(albumPhotos)
    .innerJoin(photos, eq(photos.id, albumPhotos.photoId))
    .where(and(eq(albumPhotos.familyId, familyId), eq(albumPhotos.albumId, albumId)))
    .all();

  return { ...album, photos: rows.map(({ photo }) => photo) };
}

export function createPlanRepo(db: Db) {
  return {
    listVisible: async (familyId: string, memberId: string) => listVisible(db, familyId, memberId),
    findTree: async (familyId: string, planId: string) => findTree(db, familyId, planId),

    isInFamily: async (familyId: string, memberId: string) => isInFamily(db, familyId, memberId),
    hasPet: async (familyId: string, petId: string) => hasPet(db, familyId, petId),
    albumOf: async (target: { familyId: string; albumId: string }) => albumOf(db, target),

    async parentOf(familyId: string, subplanId: string): Promise<string | undefined> {
      const row = await db
        .select({ parentId: plans.parentId })
        .from(plans)
        .where(inFamily(familyId, eq(plans.id, subplanId)))
        .get();

      return row?.parentId ?? undefined;
    },

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
