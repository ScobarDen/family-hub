import { eq, type SQL } from "drizzle-orm";

import { families, familyMembers, members, type Db } from "@/common/db";

import type { Membership } from "./auth.types.ts";

// Membership is what scopes every later query by familyId, so it alone is looked up without one.
export function createMembershipRepo(db: Db) {
  async function findWhere(condition: SQL): Promise<Membership | undefined> {
    const row = await db
      .select({
        memberId: members.id,
        memberName: members.name,
        telegramId: members.telegramId,
        familyId: families.id,
        familyName: families.name,
        ownerMemberId: families.ownerMemberId,
      })
      .from(familyMembers)
      .innerJoin(members, eq(members.id, familyMembers.memberId))
      .innerJoin(families, eq(families.id, familyMembers.familyId))
      .where(condition)
      .get();

    if (!row) {
      return undefined;
    }

    return {
      member: { id: row.memberId, name: row.memberName, telegramId: row.telegramId },
      family: { id: row.familyId, name: row.familyName },
      isFamilyOwner: row.ownerMemberId === row.memberId,
    };
  }

  return {
    findByMemberId: async (memberId: string) => findWhere(eq(members.id, memberId)),
    findByTelegramId: async (telegramId: number) => findWhere(eq(members.telegramId, telegramId)),
  };
}

export type MembershipRepo = ReturnType<typeof createMembershipRepo>;
