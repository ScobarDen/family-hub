import { and, desc, eq, type SQL } from "drizzle-orm";

import { devices, families, familyMembers, members, type Db } from "@/modules/db";

import type { Membership } from "./auth.types.ts";

async function findWhere(db: Db, condition: SQL): Promise<Membership | undefined> {
  const row = await db
    .select({
      member: {
        id: members.id,
        name: members.name,
        profilePicture: members.profilePicture,
        telegramId: members.telegramId,
        canMessage: members.canMessage,
        timeZone: members.timeZone,
        reminderChannel: members.reminderChannel,
      },
      family: { id: families.id, name: families.name },
      ownerMemberId: families.ownerMemberId,
    })
    .from(familyMembers)
    .innerJoin(members, eq(members.id, familyMembers.memberId))
    .innerJoin(families, eq(families.id, familyMembers.familyId))
    .where(condition)
    .get();

  return (
    row && {
      member: row.member,
      family: row.family,
      isFamilyOwner: row.ownerMemberId === row.member.id,
    }
  );
}

// Membership is what scopes every later query by familyId, so it alone is looked up without one.
export function createMembershipRepo(db: Db) {
  return {
    findByMemberId: async (memberId: string) => findWhere(db, eq(members.id, memberId)),
    findByTelegramId: async (telegramId: number) =>
      findWhere(db, eq(members.telegramId, telegramId)),

    async setCanMessage(memberId: string, canMessage: boolean, now: number): Promise<void> {
      await db.update(members).set({ canMessage, updatedAt: now }).where(eq(members.id, memberId));
    },

    async setProfilePicture(memberId: string, profilePicture: string | null, now: number) {
      await db
        .update(members)
        .set({ profilePicture, updatedAt: now })
        .where(eq(members.id, memberId));
    },
  };
}

export type MembershipRepo = ReturnType<typeof createMembershipRepo>;

export type DeviceRow = typeof devices.$inferSelect;

// A Device belongs to a Member, not to a Family, so it is addressed by memberId like the members row.
export function createDeviceRepo(db: Db) {
  return {
    async insert(device: DeviceRow): Promise<void> {
      await db.insert(devices).values(device);
    },

    findByCredentialHash: async (credentialHash: string): Promise<DeviceRow | undefined> =>
      db.select().from(devices).where(eq(devices.credentialHash, credentialHash)).get(),

    async touch(id: string, now: number): Promise<void> {
      await db.update(devices).set({ lastUsedAt: now }).where(eq(devices.id, id));
    },

    listOf: async (memberId: string): Promise<DeviceRow[]> =>
      db
        .select()
        .from(devices)
        .where(eq(devices.memberId, memberId))
        .orderBy(desc(devices.lastUsedAt))
        .all(),

    isOwnedBy: async (memberId: string, id: string): Promise<boolean> =>
      (await db
        .select({ id: devices.id })
        .from(devices)
        .where(and(eq(devices.id, id), eq(devices.memberId, memberId)))
        .get()) !== undefined,

    async remove(memberId: string, id: string): Promise<boolean> {
      const removed = await db
        .delete(devices)
        .where(and(eq(devices.id, id), eq(devices.memberId, memberId)))
        .returning({ id: devices.id });

      return removed.length > 0;
    },

    async removeExpired(id: string): Promise<void> {
      await db.delete(devices).where(eq(devices.id, id));
    },
  };
}

export type DeviceRepo = ReturnType<typeof createDeviceRepo>;
