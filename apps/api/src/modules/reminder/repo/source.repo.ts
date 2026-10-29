import { and, eq, isNull } from "drizzle-orm";

import { bindFirst } from "@/common/bind.lib.ts";
import { familyMembers, members, pets, tasks, type Db } from "@/modules/db";

export type PetRow = typeof pets.$inferSelect;

export type DigestRow = Pick<typeof members.$inferSelect, "isDigestEnabled" | "digestTime">;

type InFamily = { familyId: string; id: string };

export type FamilyHolderKind = "task" | "pet";

type FamilyHolder = { kind: FamilyHolderKind; id: string };

function heldBy(kind: FamilyHolderKind, rows: Array<{ id: string }>): FamilyHolder[] {
  return rows.map(({ id }) => ({ kind, id }));
}

// A digest belongs to its Member, not to the Family, so it is not among these.
async function holdersOf(db: Db, familyId: string): Promise<FamilyHolder[]> {
  const [taskRows, petRows] = await Promise.all([
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.familyId, familyId), isNull(tasks.parentId)))
      .all(),
    db.select({ id: pets.id }).from(pets).where(eq(pets.familyId, familyId)).all(),
  ]);

  return [...heldBy("task", taskRows), ...heldBy("pet", petRows)];
}

async function petOf(db: Db, { familyId, id }: InFamily): Promise<PetRow | undefined> {
  return db
    .select()
    .from(pets)
    .where(and(eq(pets.familyId, familyId), eq(pets.id, id)))
    .get();
}

async function tasksOfPet(db: Db, { familyId, id }: InFamily): Promise<string[]> {
  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.familyId, familyId), eq(tasks.petId, id)))
    .all();

  return rows.map((row) => row.id);
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
      pet: petOf,
      tasksOfPet,
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
