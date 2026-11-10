import type { Membership } from "@/modules/auth";
import { ignoringBotErrors } from "@/modules/telegram";

import { removedText } from "../family.lib.ts";
import type { FamilyDependencies } from "../family.types.ts";

type LeaveResult = { status: "left" } | { status: "family-deleted" } | { status: "must-hand-over" };

export type RemoveResult =
  | { status: "removed" }
  | { status: "not-owner" }
  | { status: "not-found" };

// A departing Member's Tasks and Savings Goals pass to the Family Owner.
async function departed(
  { families, schedule, live, clock }: FamilyDependencies,
  { familyId, memberId }: { familyId: string; memberId: string },
): Promise<void> {
  await families.depart({ familyId, memberId, now: clock.now() });
  await schedule.membershipChanged(familyId);
  live.changed(familyId, ["feed", "tasks", "goals"]);
}

// The last Member leaving takes the Family with them; an Owner among others hands over first.
export async function leave(
  dependencies: FamilyDependencies,
  { family, member, isFamilyOwner }: Membership,
): Promise<LeaveResult> {
  const { families } = dependencies;

  if (!isFamilyOwner) {
    await departed(dependencies, { familyId: family.id, memberId: member.id });

    return { status: "left" };
  }

  if ((await families.countMembers(family.id)) > 1) {
    return { status: "must-hand-over" };
  }

  await families.delete(family.id);

  return { status: "family-deleted" };
}

export async function remove(
  dependencies: FamilyDependencies,
  { family, member, isFamilyOwner }: Membership,
  memberId: string,
): Promise<RemoveResult> {
  const { families, bot } = dependencies;

  if (!isFamilyOwner) {
    return { status: "not-owner" };
  }

  const removed =
    memberId === member.id ? undefined : await families.findMember(family.id, memberId);

  if (!removed) {
    return { status: "not-found" };
  }

  await departed(dependencies, { familyId: family.id, memberId });
  await ignoringBotErrors(
    bot.call("sendMessage", { chat_id: removed.telegramId, text: removedText(family.name) }),
  );

  return { status: "removed" };
}
