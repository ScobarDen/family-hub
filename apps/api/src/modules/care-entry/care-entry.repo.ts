import { and, desc, eq, gte, isNotNull, lt, type SQL } from "drizzle-orm";

import { careEntries, members, pets, type Db } from "@/common/db";

export type CareEntryRow = typeof careEntries.$inferSelect & { authorName: string | null };

type ExpenseQuery = { familyId: string; petId: string; from: number; to: number };

async function selectWhere(db: Db, condition: SQL | undefined): Promise<CareEntryRow[]> {
  const rows = await db
    .select({ entry: careEntries, authorName: members.name })
    .from(careEntries)
    .leftJoin(members, eq(members.id, careEntries.createdBy))
    .where(condition)
    .orderBy(desc(careEntries.occurredAt))
    .all();

  return rows.map(({ entry, authorName }) => ({ ...entry, authorName }));
}

function inFamily(familyId: string, entryId: string) {
  return and(eq(careEntries.familyId, familyId), eq(careEntries.id, entryId));
}

async function find(db: Db, familyId: string, entryId: string) {
  const [row] = await selectWhere(db, inFamily(familyId, entryId));

  return row;
}

async function petOf(db: Db, familyId: string, petId: string) {
  return db
    .select({ id: pets.id, archivedAt: pets.archivedAt })
    .from(pets)
    .where(and(eq(pets.familyId, familyId), eq(pets.id, petId)))
    .get();
}

async function dueCandidates(db: Db, familyId: string, petId: string) {
  return selectWhere(
    db,
    and(
      eq(careEntries.familyId, familyId),
      eq(careEntries.petId, petId),
      isNotNull(careEntries.dueKey),
    ),
  );
}

// A Member's own zone sits on their row, which belongs to no Family.
async function timeZoneOf(db: Db, memberId: string): Promise<string | null> {
  const row = await db
    .select({ timeZone: members.timeZone })
    .from(members)
    .where(eq(members.id, memberId))
    .get();

  return row?.timeZone ?? null;
}

async function expenses(db: Db, { familyId, petId, from, to }: ExpenseQuery) {
  return selectWhere(
    db,
    and(
      eq(careEntries.familyId, familyId),
      eq(careEntries.petId, petId),
      isNotNull(careEntries.expenseAmount),
      gte(careEntries.occurredAt, from),
      lt(careEntries.occurredAt, to),
    ),
  );
}

export function createCareEntryRepo(db: Db) {
  return {
    list: async (familyId: string, petId: string) =>
      selectWhere(db, and(eq(careEntries.familyId, familyId), eq(careEntries.petId, petId))),
    find: async (familyId: string, entryId: string) => find(db, familyId, entryId),
    petOf: async (familyId: string, petId: string) => petOf(db, familyId, petId),
    dueCandidates: async (familyId: string, petId: string) => dueCandidates(db, familyId, petId),
    timeZoneOf: async (memberId: string) => timeZoneOf(db, memberId),
    expenses: async (query: ExpenseQuery) => expenses(db, query),

    async add(entry: typeof careEntries.$inferInsert): Promise<void> {
      await db.insert(careEntries).values(entry);
    },

    async update(
      familyId: string,
      entryId: string,
      values: Partial<typeof careEntries.$inferInsert>,
    ): Promise<void> {
      await db.update(careEntries).set(values).where(inFamily(familyId, entryId));
    },

    async delete(familyId: string, entryId: string): Promise<void> {
      await db.delete(careEntries).where(inFamily(familyId, entryId));
    },
  };
}

export type CareEntryRepo = ReturnType<typeof createCareEntryRepo>;
