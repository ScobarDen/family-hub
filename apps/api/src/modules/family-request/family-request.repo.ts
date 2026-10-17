import { and, desc, eq } from "drizzle-orm";

import { families, familyMembers, familyRequests, members, type Db } from "@/common/db";

export type FamilyRequest = typeof familyRequests.$inferSelect;

type Decision = "rejected" | "stale";

type Approval = { request: FamilyRequest; familyId: string; newMemberId: string; now: number };

function isPending(id: string) {
  return and(eq(familyRequests.id, id), eq(familyRequests.status, "pending"));
}

async function existingMemberId(db: Db, telegramId: number): Promise<string | undefined> {
  const member = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.telegramId, telegramId))
    .get();

  return member?.id;
}

// The requester may be a Member who once left a Family; they keep their Member row.
async function approve(db: Db, { request, familyId, newMemberId, now }: Approval): Promise<void> {
  const memberId = (await existingMemberId(db, request.telegramId)) ?? newMemberId;
  const audit = { createdAt: now, createdBy: memberId, updatedAt: now };
  const member = {
    id: memberId,
    telegramId: request.telegramId,
    name: request.requesterName,
    createdAt: now,
    updatedAt: now,
  };

  await db.batch([
    db.insert(members).values(member).onConflictDoNothing(),
    db
      .insert(families)
      .values({ id: familyId, name: request.familyName, ownerMemberId: memberId, ...audit }),
    db.insert(familyMembers).values({ familyId, memberId, ...audit }),
    db
      .update(familyRequests)
      .set({ status: "approved", decidedAt: now, updatedAt: now })
      .where(isPending(request.id)),
  ]);
}

// Family Requests come before any Family exists, so none of these queries can be scoped by familyId.
export function createFamilyRequestRepo(db: Db) {
  return {
    findById: async (id: string) =>
      db.select().from(familyRequests).where(eq(familyRequests.id, id)).get(),

    findLatest: async (telegramId: number) =>
      db
        .select()
        .from(familyRequests)
        .where(eq(familyRequests.telegramId, telegramId))
        .orderBy(desc(familyRequests.createdAt))
        .get(),

    async add(request: FamilyRequest): Promise<void> {
      await db.insert(familyRequests).values(request);
    },

    async remove(id: string): Promise<void> {
      await db.delete(familyRequests).where(eq(familyRequests.id, id));
    },

    async decide(id: string, status: Decision, now: number): Promise<FamilyRequest | undefined> {
      const [decided] = await db
        .update(familyRequests)
        .set({ status, decidedAt: now, updatedAt: now })
        .where(isPending(id))
        .returning();

      return decided;
    },
    approve: async (approval: Approval) => approve(db, approval),
  };
}

export type FamilyRequestRepo = ReturnType<typeof createFamilyRequestRepo>;
