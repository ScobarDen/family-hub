import { and, eq, exists, gt, isNull, sql } from "drizzle-orm";

import {
  events,
  families,
  familyMembers,
  goals,
  invites,
  members,
  plans,
  reminders,
  type Db,
} from "@/common/db";

export type FamilyMemberRow = { id: string; name: string; telegramId: number };

type Departure = { familyId: string; memberId: string; now: number };

type HandOver = { familyId: string; fromMemberId: string; toMemberId: string; now: number };

function departFromPlans(db: Db, { familyId, memberId, now }: Departure) {
  const ofFamily = eq(plans.familyId, familyId);
  const familyOwner = sql`(select ${families.ownerMemberId} from ${families} where ${families.id} = ${familyId})`;

  return [
    db
      .delete(plans)
      .where(and(ofFamily, eq(plans.ownerMemberId, memberId), eq(plans.visibility, "private"))),
    db
      .update(plans)
      .set({ ownerMemberId: familyOwner, updatedAt: now })
      .where(and(ofFamily, eq(plans.ownerMemberId, memberId))),
    db
      .update(plans)
      .set({ assigneeMemberId: null, updatedAt: now })
      .where(and(ofFamily, eq(plans.assigneeMemberId, memberId), isNull(plans.completedAt))),
  ] as const;
}

function departFromEvents(db: Db, { familyId, memberId, now }: Departure) {
  const ofFamily = eq(events.familyId, familyId);
  const familyOwner = sql`(select ${families.ownerMemberId} from ${families} where ${families.id} = ${familyId})`;

  return [
    db
      .delete(events)
      .where(and(ofFamily, eq(events.ownerMemberId, memberId), eq(events.visibility, "private"))),
    db
      .update(events)
      .set({ ownerMemberId: familyOwner, updatedAt: now })
      .where(and(ofFamily, eq(events.ownerMemberId, memberId))),
  ] as const;
}

function departFromReminders(db: Db, { familyId, memberId, now }: Departure) {
  const familyOwner = sql`(select ${families.ownerMemberId} from ${families} where ${families.id} = ${familyId})`;

  return [
    db
      .delete(reminders)
      .where(
        and(
          eq(reminders.familyId, familyId),
          eq(reminders.ownerMemberId, memberId),
          eq(reminders.visibility, "private"),
        ),
      ),
    db
      .update(reminders)
      .set({ ownerMemberId: familyOwner, updatedAt: now })
      .where(and(eq(reminders.familyId, familyId), eq(reminders.ownerMemberId, memberId))),
  ] as const;
}

function departFromGoals(db: Db, { familyId, memberId, now }: Departure) {
  const ofFamily = eq(goals.familyId, familyId);
  const familyOwner = sql`(select ${families.ownerMemberId} from ${families} where ${families.id} = ${familyId})`;

  return [
    db
      .delete(goals)
      .where(and(ofFamily, eq(goals.ownerMemberId, memberId), eq(goals.visibility, "private"))),
    db
      .update(goals)
      .set({ ownerMemberId: familyOwner, updatedAt: now })
      .where(and(ofFamily, eq(goals.ownerMemberId, memberId))),
  ] as const;
}

// Private records of the one who leaves go and their Shared ones pass to the Family Owner: every
// table with owner_member_id joins this batch. Their Reminder rows are the reminder module's to drop.
async function depart(db: Db, departure: Departure): Promise<void> {
  const { familyId, memberId, now } = departure;

  await db.batch([
    ...departFromPlans(db, departure),
    ...departFromEvents(db, departure),
    ...departFromReminders(db, departure),
    ...departFromGoals(db, departure),
    db
      .delete(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.memberId, memberId))),
    db
      .update(invites)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          eq(invites.familyId, familyId),
          eq(invites.createdBy, memberId),
          isNull(invites.usedAt),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, now),
        ),
      ),
  ]);
}

async function handOver(
  db: Db,
  { familyId, fromMemberId, toMemberId, now }: HandOver,
): Promise<{ id: string } | undefined> {
  const isInFamily = exists(
    db
      .select({ memberId: familyMembers.memberId })
      .from(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.memberId, toMemberId))),
  );
  const [changed] = await db
    .update(families)
    .set({ ownerMemberId: toMemberId, updatedAt: now })
    .where(and(eq(families.id, familyId), eq(families.ownerMemberId, fromMemberId), isInFamily))
    .returning({ id: families.id });

  return changed;
}

export function createFamilyRepo(db: Db) {
  return {
    findMember: async (familyId: string, memberId: string): Promise<FamilyMemberRow | undefined> =>
      db
        .select({ id: members.id, name: members.name, telegramId: members.telegramId })
        .from(familyMembers)
        .innerJoin(members, eq(members.id, familyMembers.memberId))
        .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.memberId, memberId)))
        .get(),

    countMembers: async (familyId: string) =>
      db.$count(familyMembers, eq(familyMembers.familyId, familyId)),

    depart: async (departure: Departure) => depart(db, departure),
    handOver: async (change: HandOver) => handOver(db, change),

    // Everything of the Family cascades from its row; Member rows stay, as they belong to no Family.
    async delete(familyId: string): Promise<void> {
      await db.delete(families).where(eq(families.id, familyId));
    },
  };
}

export type FamilyRepo = ReturnType<typeof createFamilyRepo>;
