import { and, asc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";

import { commandDrafts, familyMembers, members, pets, type Db } from "@/common/db";

export type CommandDraftRow = typeof commandDrafts.$inferSelect;

export type FamilyPerson = { id: string; name: string };

export type FamilyPet = FamilyPerson & { species: string };

// Who a draft may refer to: the Members by name and the Pets in care.
export type FamilyNames = { members: FamilyPerson[]; pets: FamilyPet[] };

// The speaker's Family as the prompt sees it, and the speaker's own clock.
function familyQueries(db: Db) {
  return {
    membersOf: async (familyId: string): Promise<FamilyPerson[]> =>
      db
        .select({ id: members.id, name: members.name })
        .from(familyMembers)
        .innerJoin(members, eq(members.id, familyMembers.memberId))
        .where(eq(familyMembers.familyId, familyId))
        .orderBy(asc(familyMembers.createdAt))
        .all(),
    petsOf: async (familyId: string): Promise<FamilyPet[]> =>
      db
        .select({ id: pets.id, name: pets.name, species: pets.species })
        .from(pets)
        .where(and(eq(pets.familyId, familyId), isNull(pets.archivedAt)))
        .orderBy(asc(pets.createdAt))
        .all(),
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

type DraftInsert = typeof commandDrafts.$inferInsert;

type Quota = { since: number; limit: number };

// The day's rows are counted up to this one in insertion order (SQLite's rowid; ids of one
// millisecond are unordered), so of commands sent at once exactly the first ones within the limit stay.
async function reserve(
  db: Db,
  row: DraftInsert,
  { since, limit }: Quota,
): Promise<"reserved" | "over-quota"> {
  const rowid = sql<number>`rowid`;
  const [inserted] = await db.insert(commandDrafts).values(row).returning({ position: rowid });
  const ahead = await db.$count(
    commandDrafts,
    and(
      eq(commandDrafts.familyId, row.familyId),
      gte(commandDrafts.createdAt, since),
      lte(rowid, inserted?.position ?? 0),
    ),
  );

  if (ahead <= limit) {
    return "reserved";
  }

  await db.delete(commandDrafts).where(eq(commandDrafts.id, row.id));

  return "over-quota";
}

export function createCommandRepo(db: Db) {
  return {
    reserve: async (row: DraftInsert, quota: Quota) => reserve(db, row, quota),
    // The bot's buttons know a draft by its id alone; the row names its Family and author.
    find: async (draftId: string): Promise<CommandDraftRow | undefined> =>
      db.select().from(commandDrafts).where(eq(commandDrafts.id, draftId)).get(),
    async update(draftId: string, values: Partial<typeof commandDrafts.$inferInsert>) {
      await db.update(commandDrafts).set(values).where(eq(commandDrafts.id, draftId));
    },
    // Of two «Создать» pressed at once, only the one that moves the draft off pending goes on.
    async claimForCreation(draftId: string, now: number): Promise<CommandDraftRow | undefined> {
      const [claimed] = await db
        .update(commandDrafts)
        .set({ status: "creating", updatedAt: now })
        .where(and(eq(commandDrafts.id, draftId), eq(commandDrafts.status, "pending")))
        .returning();

      return claimed;
    },
    async sweep(now: number): Promise<void> {
      await db.delete(commandDrafts).where(lt(commandDrafts.expiresAt, now));
    },

    ...familyQueries(db),
  };
}

export type CommandRepo = ReturnType<typeof createCommandRepo>;
