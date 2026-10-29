import { uuidv7, type InvitePreview } from "@family-hub/contract";

import { displayNameOf, type TelegramUser } from "@/modules/auth";

import type { FoundInvite } from "../invite.repo.ts";
import type { InviteDependencies } from "../invite.types.ts";

export type AcceptResult =
  | { status: "joined" }
  | { status: "unavailable" }
  | { status: "already-member" };

function isOpen({ invite }: FoundInvite, now: number): boolean {
  return invite.usedAt === null && invite.revokedAt === null && now < invite.expiresAt;
}

// A Member reopening the link they joined by is home, not looking at a spent Invite.
export async function preview(
  { invites, memberships, clock }: InviteDependencies,
  user: TelegramUser,
  token: string,
): Promise<InvitePreview> {
  const found = await invites.findByToken(token);
  const membership = await memberships.findByTelegramId(user.id);

  if (membership && found?.invite.familyId === membership.family.id) {
    return { status: "in-this-family" };
  }

  if (!found || !isOpen(found, clock.now())) {
    return { status: "unavailable" };
  }

  if (membership) {
    return { status: "in-other-family" };
  }

  return { status: "open", inviterName: found.inviterName, familyName: found.familyName };
}

async function joinClaimed(
  { invites, memberships, schedule, clock }: InviteDependencies,
  user: TelegramUser,
  token: string,
): Promise<AcceptResult> {
  const now = clock.now();
  const claimed = await invites.claim(token, now);

  if (!claimed) {
    return { status: "unavailable" };
  }

  try {
    await invites.join({
      invite: claimed,
      joiner: { telegramId: user.id, name: displayNameOf(user), newMemberId: uuidv7(now) },
      now,
    });
  } catch (error) {
    await invites.release(claimed, now);

    // Joining another Family in parallel meets the one-Family-per-Member index.
    if (await memberships.findByTelegramId(user.id)) {
      return { status: "already-member" };
    }

    throw error;
  }

  await schedule.membershipChanged(claimed.familyId);

  return { status: "joined" };
}

export async function accept(
  dependencies: InviteDependencies,
  user: TelegramUser,
  token: string,
): Promise<AcceptResult> {
  if (await dependencies.memberships.findByTelegramId(user.id)) {
    return { status: "already-member" };
  }

  const result = await joinClaimed(dependencies, user, token);

  if (result.status === "joined") {
    await dependencies.familyRequests.cancelPending(user.id);
  }

  return result;
}
