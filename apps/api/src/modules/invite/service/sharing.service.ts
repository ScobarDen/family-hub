import { uuidv7, type Invite, type InviteCreated } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import { BotApiError } from "@/common/telegram";

import { inviteLifetimeMs } from "../invite.config.ts";
import { inviteLink, newInviteToken, shareCard } from "../invite.lib.ts";
import type { InviteRow } from "../invite.repo.ts";
import type { InviteDependencies } from "../invite.types.ts";

function toInvite({ miniAppLink }: InviteDependencies, row: InviteRow): Invite {
  return { id: row.id, link: inviteLink(miniAppLink, row.token), expiresAt: row.expiresAt };
}

// Without a prepared message the Mini App still shares the bare link.
async function prepareShareMessage(
  { bot }: InviteDependencies,
  membership: Membership,
  invite: Invite,
): Promise<string | null> {
  try {
    const prepared = await bot.call("savePreparedInlineMessage", {
      user_id: membership.member.telegramId,
      result: shareCard({
        inviteId: invite.id,
        link: invite.link,
        inviterName: membership.member.name,
        familyName: membership.family.name,
      }),
      allow_user_chats: true,
      allow_group_chats: true,
    });

    return prepared.id;
  } catch (error) {
    if (error instanceof BotApiError) {
      return null;
    }

    throw error;
  }
}

export async function create(
  dependencies: InviteDependencies,
  membership: Membership,
): Promise<InviteCreated> {
  const now = dependencies.clock.now();
  const row: InviteRow = {
    id: uuidv7(now),
    familyId: membership.family.id,
    token: newInviteToken(),
    expiresAt: now + inviteLifetimeMs,
    usedAt: null,
    usedBy: null,
    revokedAt: null,
    createdAt: now,
    createdBy: membership.member.id,
    updatedAt: now,
  };

  await dependencies.invites.add(row);

  const invite = toInvite(dependencies, row);

  return {
    ...invite,
    preparedMessageId: await prepareShareMessage(dependencies, membership, invite),
  };
}

export async function listOpen(
  dependencies: InviteDependencies,
  { family, member }: Membership,
): Promise<Invite[]> {
  const rows = await dependencies.invites.listOpen(family.id, member.id, dependencies.clock.now());

  return rows.map((row) => toInvite(dependencies, row));
}

export type RevokeResult = { status: "revoked" } | { status: "not-found" };

export async function revoke(
  { invites, clock }: InviteDependencies,
  { family, member }: Membership,
  inviteId: string,
): Promise<RevokeResult> {
  const revoked = await invites.revoke({
    familyId: family.id,
    memberId: member.id,
    inviteId,
    now: clock.now(),
  });

  return { status: revoked === undefined ? "not-found" : "revoked" };
}
