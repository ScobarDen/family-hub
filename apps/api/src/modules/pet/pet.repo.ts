import { and, asc, eq, type SQL } from "drizzle-orm";

import type { PetMemoChange, PetProfile } from "@family-hub/contract";

import { members, pets, type Db } from "@/common/db";

export type PetRow = typeof pets.$inferSelect & { memoUpdatedByName: string | null };

type PetTarget = { familyId: string; petId: string };

type PetChange<Values> = PetTarget & { values: Values; memberId: string; now: number };

async function selectWhere(db: Db, condition: SQL | undefined): Promise<PetRow[]> {
  const rows = await db
    .select({ pet: pets, memoUpdatedByName: members.name })
    .from(pets)
    .leftJoin(members, eq(members.id, pets.memoUpdatedBy))
    .where(condition)
    .orderBy(asc(pets.createdAt))
    .all();

  return rows.map(({ pet, memoUpdatedByName }) => ({ ...pet, memoUpdatedByName }));
}

async function find(db: Db, { familyId, petId }: PetTarget): Promise<PetRow | undefined> {
  const [row] = await selectWhere(db, and(eq(pets.familyId, familyId), eq(pets.id, petId)));

  return row;
}

async function update(
  db: Db,
  target: PetTarget,
  values: Partial<typeof pets.$inferInsert>,
): Promise<PetRow | undefined> {
  const changed = await db
    .update(pets)
    .set(values)
    .where(and(eq(pets.familyId, target.familyId), eq(pets.id, target.petId)))
    .returning({ id: pets.id });

  return changed.length === 0 ? undefined : find(db, target);
}

export function createPetRepo(db: Db) {
  return {
    list: async (familyId: string) => selectWhere(db, eq(pets.familyId, familyId)),
    find: async (familyId: string, petId: string) => find(db, { familyId, petId }),

    setArchivedAt: async ({
      familyId,
      petId,
      archivedAt,
      now,
    }: PetTarget & { archivedAt: number | null; now: number }) =>
      update(db, { familyId, petId }, { archivedAt, updatedAt: now }),

    async delete(familyId: string, petId: string): Promise<void> {
      await db.delete(pets).where(and(eq(pets.familyId, familyId), eq(pets.id, petId)));
    },

    async add(pet: typeof pets.$inferInsert): Promise<void> {
      await db.insert(pets).values(pet);
    },

    saveProfile: async ({ values, now, familyId, petId }: PetChange<PetProfile>) =>
      update(db, { familyId, petId }, { ...values, updatedAt: now }),

    saveMemo: async ({ values, memberId, now, familyId, petId }: PetChange<PetMemoChange>) =>
      update(
        db,
        { familyId, petId },
        {
          memoFood: values.food,
          memoClinic: values.clinic,
          memoImportant: values.important,
          memoUpdatedAt: now,
          memoUpdatedBy: memberId,
          updatedAt: now,
        },
      ),
  };
}

export type PetRepo = ReturnType<typeof createPetRepo>;
