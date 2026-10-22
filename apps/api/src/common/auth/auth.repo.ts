import { eq, type SQL } from "drizzle-orm";

import { families, familyMembers, members, type Db } from "@/common/db";

import type { Membership } from "./auth.types.ts";

async function findWhere(db: Db, condition: SQL): Promise<Membership | undefined> {
  const row = await db
    .select({
      member: {
        id: members.id,
        name: members.name,
        telegramId: members.telegramId,
        canMessage: members.canMessage,
        timeZone: members.timeZone,
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
  };
}

export type MembershipRepo = ReturnType<typeof createMembershipRepo>;
