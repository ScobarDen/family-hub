import { asc, eq, sql } from "drizzle-orm";

import type { AppModule, DigestSettings, ReminderChannel } from "@family-hub/contract";

import { bindFirst } from "@/common/bind.lib.ts";
import { families, familyMembers, members, type Db } from "@/modules/db";

export type MemberSettingsRow = Pick<
  typeof members.$inferSelect,
  | "tabBar"
  | "timeZone"
  | "isTimeZoneAuto"
  | "canMessage"
  | "isDigestEnabled"
  | "digestTime"
  | "reminderChannel"
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

async function listFamily(db: Db, familyId: string) {
  return db
    .select({
      id: members.id,
      name: members.name,
      profilePicture: members.profilePicture,
      ownerMemberId: families.ownerMemberId,
    })
    .from(familyMembers)
    .innerJoin(members, eq(members.id, familyMembers.memberId))
    .innerJoin(families, eq(families.id, familyMembers.familyId))
    .where(eq(familyMembers.familyId, familyId))
    .orderBy(
      sql`${members.id} = ${families.ownerMemberId} desc`,
      asc(familyMembers.createdAt),
      asc(members.name),
    )
    .all();
}

export function createMemberRepo(db: Db) {
  async function update(memberId: string, values: Partial<typeof members.$inferInsert>) {
    await db.update(members).set(values).where(eq(members.id, memberId));
  }

  return {
    ...bindFirst(db, { allowMessages, listFamily }),
    settingsOf: async (memberId: string): Promise<MemberSettingsRow | undefined> =>
      db
        .select({
          tabBar: members.tabBar,
          timeZone: members.timeZone,
          isTimeZoneAuto: members.isTimeZoneAuto,
          canMessage: members.canMessage,
          isDigestEnabled: members.isDigestEnabled,
          digestTime: members.digestTime,
          reminderChannel: members.reminderChannel,
        })
        .from(members)
        .where(eq(members.id, memberId))
        .get(),

    saveTabBar: async (memberId: string, tabBar: AppModule[], now: number) =>
      update(memberId, { tabBar, updatedAt: now }),

    saveTimeZone: async (memberId: string, { timeZone, isAuto }: TimeZoneChange, now: number) =>
      update(memberId, { timeZone, isTimeZoneAuto: isAuto, updatedAt: now }),

    saveDigest: async (memberId: string, { isEnabled, time }: DigestSettings, now: number) =>
      update(memberId, { isDigestEnabled: isEnabled, digestTime: time, updatedAt: now }),

    saveReminderChannel: async (memberId: string, reminderChannel: ReminderChannel, now: number) =>
      update(memberId, { reminderChannel, updatedAt: now }),
  };
}

export type MemberRepo = ReturnType<typeof createMemberRepo>;
