import type { Membership } from "@/common/auth";
import { ignoringBotErrors } from "@/common/telegram";

import { isSameFamilyName, newOwnerText } from "../family.lib.ts";
import type { FamilyDependencies } from "../family.types.ts";

type HandOverResult = { status: "handed-over" } | { status: "not-owner" } | { status: "not-found" };

export type DeleteResult =
  | { status: "deleted" }
  | { status: "not-owner" }
  | { status: "name-mismatch" };

export async function handOver(
  { families, bot, clock }: FamilyDependencies,
  { family, member, isFamilyOwner }: Membership,
  memberId: string,
): Promise<HandOverResult> {
  if (!isFamilyOwner) {
    return { status: "not-owner" };
  }

  const newOwner =
    memberId === member.id ? undefined : await families.findMember(family.id, memberId);
  const changed =
    newOwner &&
    (await families.handOver({
      familyId: family.id,
      fromMemberId: member.id,
      toMemberId: newOwner.id,
      now: clock.now(),
    }));

  if (!newOwner || !changed) {
    return { status: "not-found" };
  }

  await ignoringBotErrors(
    bot.call("sendMessage", {
      chat_id: newOwner.telegramId,
      text: newOwnerText({ familyName: family.name, formerOwnerName: member.name }),
    }),
  );

  return { status: "handed-over" };
}

export async function deleteFamily(
  { families }: FamilyDependencies,
  { family, isFamilyOwner }: Membership,
  familyName: string,
): Promise<DeleteResult> {
  if (!isFamilyOwner) {
    return { status: "not-owner" };
  }

  if (!isSameFamilyName(familyName, family.name)) {
    return { status: "name-mismatch" };
  }

  await families.delete(family.id);

  return { status: "deleted" };
}
