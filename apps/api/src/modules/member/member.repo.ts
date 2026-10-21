import { asc, eq, sql } from "drizzle-orm";

import type { AppModule } from "@family-hub/contract";

import { families, familyMembers, members, type Db } from "@/common/db";

export type MemberSettingsRow = Pick<
  typeof members.$inferSelect,
  "tabBar" | "timeZone" | "isTimeZoneAuto" | "canMessage"
>;

type TimeZoneChange = { timeZone: string; isAuto: boolean };

// A Member's own row belongs to no Family, so it is addressed by the session's memberId alone.
// /start comes from Telegram with the user's id, before any session exists.
async function allowMessages(db: Db, telegramId: number, now: number): Promise<void> {
  await db
    .update(members)
    .set({ canMessage: true, updatedAt: now })
    .where(eq(members.telegramId, telegramId));
}

export function createMemberRepo(db: Db) {
  async function update(memberId: string, values: Partial<typeof members.$inferInsert>) {
    await db.update(members).set(values).where(eq(members.id, memberId));
  }

  return {
    settingsOf: async (memberId: string): Promise<MemberSettingsRow | undefined> =>
      db
        .select({
          tabBar: members.tabBar,
          timeZone: members.timeZone,
          isTimeZoneAuto: members.isTimeZoneAuto,
          canMessage: members.canMessage,
        })
        .from(members)
        .where(eq(members.id, memberId))
        .get(),

    allowMessages: async (telegramId: number, now: number) => allowMessages(db, telegramId, now),

    saveTabBar: async (memberId: string, tabBar: AppModule[], now: number) =>
      update(memberId, { tabBar, updatedAt: now }),

    saveTimeZone: async (memberId: string, { timeZone, isAuto }: TimeZoneChange, now: number) =>
      update(memberId, { timeZone, isTimeZoneAuto: isAuto, updatedAt: now }),

    listFamily: async (familyId: string) =>
      db
        .select({ id: members.id, name: members.name, ownerMemberId: families.ownerMemberId })
        .from(familyMembers)
        .innerJoin(members, eq(members.id, familyMembers.memberId))
        .innerJoin(families, eq(families.id, familyMembers.familyId))
        .where(eq(familyMembers.familyId, familyId))
        .orderBy(
          sql`${members.id} = ${families.ownerMemberId} desc`,
          asc(familyMembers.createdAt),
          asc(members.name),
        )
        .all(),
  };
}

export type MemberRepo = ReturnType<typeof createMemberRepo>;
