import type { Membership } from "@/common/auth";
import { ignoringBotErrors } from "@/common/telegram";

import { removedText } from "../family.lib.ts";
import type { FamilyDependencies } from "../family.types.ts";

export type LeaveResult =
  | { status: "left" }
  | { status: "family-deleted" }
  | { status: "must-hand-over" };

export type RemoveResult =
  | { status: "removed" }
  | { status: "not-owner" }
  | { status: "not-found" };

// The last Member leaving takes the Family with them; an Owner among others hands over first.
export async function leave(
  { families, schedule, clock }: FamilyDependencies,
  { family, member, isFamilyOwner }: Membership,
): Promise<LeaveResult> {
  if (!isFamilyOwner) {
    await families.depart({ familyId: family.id, memberId: member.id, now: clock.now() });
    await schedule.membershipChanged(family.id);

    return { status: "left" };
  }

  if ((await families.countMembers(family.id)) > 1) {
    return { status: "must-hand-over" };
  }

  await families.delete(family.id);

  return { status: "family-deleted" };
}

export async function remove(
  { families, schedule, bot, clock }: FamilyDependencies,
  { family, member, isFamilyOwner }: Membership,
  memberId: string,
): Promise<RemoveResult> {
  if (!isFamilyOwner) {
    return { status: "not-owner" };
  }

  const removed =
    memberId === member.id ? undefined : await families.findMember(family.id, memberId);

  if (!removed) {
    return { status: "not-found" };
  }

  await families.depart({ familyId: family.id, memberId, now: clock.now() });
  await schedule.membershipChanged(family.id);
  await ignoringBotErrors(
    bot.call("sendMessage", { chat_id: removed.telegramId, text: removedText(family.name) }),
  );

  return { status: "removed" };
}
