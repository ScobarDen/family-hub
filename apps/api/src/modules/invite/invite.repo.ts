import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { families, familyMembers, invites, members, type Db } from "@/common/db";

export type InviteRow = typeof invites.$inferSelect;

export type FoundInvite = {
  invite: InviteRow;
  inviterName: string;
  familyName: string;
};

type Joiner = { telegramId: number; name: string; newMemberId: string };

type Joining = { invite: InviteRow; joiner: Joiner; now: number };

type OwnInvite = { familyId: string; memberId: string; inviteId: string; now: number };

function isOpen(now: number) {
  return and(isNull(invites.usedAt), isNull(invites.revokedAt), gt(invites.expiresAt, now));
}

async function memberIdOf(db: Db, { telegramId, newMemberId }: Joiner): Promise<string> {
  const member = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.telegramId, telegramId))
    .get();

  return member?.id ?? newMemberId;
}

// The invited person belongs to no Family yet, so findByToken and claim go by the token, not a familyId.
async function findByToken(db: Db, token: string): Promise<FoundInvite | undefined> {
  return db
    .select({ invite: invites, inviterName: members.name, familyName: families.name })
    .from(invites)
    .innerJoin(members, eq(members.id, invites.createdBy))
    .innerJoin(families, eq(families.id, invites.familyId))
    .where(eq(invites.token, token))
    .get();
}

async function claim(db: Db, token: string, now: number): Promise<InviteRow | undefined> {
  const [claimed] = await db
    .update(invites)
    .set({ usedAt: now, updatedAt: now })
    .where(and(eq(invites.token, token), isOpen(now)))
    .returning();

  return claimed;
}

// A Member who once left a Family keeps their Member row.
async function join(db: Db, { invite, joiner, now }: Joining): Promise<void> {
  const memberId = await memberIdOf(db, joiner);
  const member = { id: memberId, telegramId: joiner.telegramId, name: joiner.name };
  const audit = { createdAt: now, createdBy: memberId, updatedAt: now };

  await db.batch([
    db
      .insert(members)
      .values({ ...member, createdAt: now, updatedAt: now })
      .onConflictDoNothing(),
    db.insert(familyMembers).values({ familyId: invite.familyId, memberId, ...audit }),
    db
      .update(invites)
      .set({ usedBy: memberId, updatedAt: now })
      .where(and(eq(invites.id, invite.id), eq(invites.familyId, invite.familyId))),
  ]);
}

async function revoke(
  db: Db,
  { familyId, memberId, inviteId, now }: OwnInvite,
): Promise<InviteRow | undefined> {
  const [revoked] = await db
    .update(invites)
    .set({ revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(invites.id, inviteId),
        eq(invites.familyId, familyId),
        eq(invites.createdBy, memberId),
        isOpen(now),
      ),
    )
    .returning();

  return revoked;
}

export function createInviteRepo(db: Db) {
  return {
    async add(invite: InviteRow): Promise<void> {
      await db.insert(invites).values(invite);
    },

    listOpen: async (familyId: string, memberId: string, now: number) =>
      db
        .select()
        .from(invites)
        .where(and(eq(invites.familyId, familyId), eq(invites.createdBy, memberId), isOpen(now)))
        .orderBy(desc(invites.createdAt))
        .all(),

    revoke: async (invite: OwnInvite) => revoke(db, invite),
    findByToken: async (token: string) => findByToken(db, token),
    claim: async (token: string, now: number) => claim(db, token, now),

    async release(invite: InviteRow, now: number): Promise<void> {
      await db
        .update(invites)
        .set({ usedAt: null, usedBy: null, updatedAt: now })
        .where(and(eq(invites.id, invite.id), eq(invites.familyId, invite.familyId)));
    },

    join: async (joining: Joining) => join(db, joining),
  };
}

export type InviteRepo = ReturnType<typeof createInviteRepo>;
