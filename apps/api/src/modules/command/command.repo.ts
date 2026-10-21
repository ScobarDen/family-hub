import { and, asc, eq, gte, lt } from "drizzle-orm";

import { commandDrafts, familyMembers, members, type Db } from "@/common/db";

export type CommandDraftRow = typeof commandDrafts.$inferSelect;

export type FamilyPerson = { id: string; name: string };

export function createCommandRepo(db: Db) {
  return {
    async add(row: typeof commandDrafts.$inferInsert): Promise<void> {
      await db.insert(commandDrafts).values(row);
    },
    // The bot's buttons know a draft by its id alone; the row names its Family and author.
    find: async (draftId: string): Promise<CommandDraftRow | undefined> =>
      db.select().from(commandDrafts).where(eq(commandDrafts.id, draftId)).get(),
    async update(draftId: string, values: Partial<typeof commandDrafts.$inferInsert>) {
      await db.update(commandDrafts).set(values).where(eq(commandDrafts.id, draftId));
    },
    async countSince({ familyId, since }: { familyId: string; since: number }): Promise<number> {
      return db.$count(
        commandDrafts,
        and(eq(commandDrafts.familyId, familyId), gte(commandDrafts.createdAt, since)),
      );
    },
    async sweep(now: number): Promise<void> {
      await db.delete(commandDrafts).where(lt(commandDrafts.expiresAt, now));
    },

    membersOf: async (familyId: string): Promise<FamilyPerson[]> =>
      db
        .select({ id: members.id, name: members.name })
        .from(familyMembers)
        .innerJoin(members, eq(members.id, familyMembers.memberId))
        .where(eq(familyMembers.familyId, familyId))
        .orderBy(asc(familyMembers.createdAt))
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

export type CommandRepo = ReturnType<typeof createCommandRepo>;
