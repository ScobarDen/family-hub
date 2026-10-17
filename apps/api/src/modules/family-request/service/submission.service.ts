import type { TelegramUser } from "@/common/auth";

import { familyRequestCooldownMs } from "../family-request.config.ts";
import { decisionButtons, newRequest, operatorText } from "../family-request.lib.ts";
import type { FamilyRequest } from "../family-request.repo.ts";
import type { FamilyRequestDependencies } from "../family-request.types.ts";

export type SubmitResult =
  | { status: "pending" }
  | { status: "already-member" }
  | { status: "already-pending" }
  | { status: "cooldown" }
  | { status: "operator-unavailable" };

async function refusal(
  { memberships, requests, clock }: FamilyRequestDependencies,
  telegramId: number,
): Promise<SubmitResult | undefined> {
  if (await memberships.findByTelegramId(telegramId)) {
    return { status: "already-member" };
  }

  const latest = await requests.findLatest(telegramId);

  if (latest?.status === "pending") {
    return { status: "already-pending" };
  }

  const isCoolingDown =
    latest?.status === "rejected" &&
    clock.now() < (latest.decidedAt ?? 0) + familyRequestCooldownMs;

  return isCoolingDown ? { status: "cooldown" } : undefined;
}

async function sendToOperator(
  { bot, operatorTelegramId }: FamilyRequestDependencies,
  request: FamilyRequest,
): Promise<void> {
  await bot.call("sendMessage", {
    chat_id: operatorTelegramId,
    text: operatorText(request),
    reply_markup: decisionButtons(request.id),
  });
}

export async function submit(
  dependencies: FamilyRequestDependencies,
  user: TelegramUser,
  familyName: string,
): Promise<SubmitResult> {
  const refused = await refusal(dependencies, user.id);

  if (refused) {
    return refused;
  }

  const request = newRequest(user, familyName, dependencies.clock.now());

  try {
    await dependencies.requests.add(request);
  } catch (error) {
    // Two submits racing past the first check meet at the one-pending-request index.
    const lostRace = await refusal(dependencies, user.id);

    if (lostRace) {
      return lostRace;
    }

    throw error;
  }

  try {
    await sendToOperator(dependencies, request);
  } catch {
    await dependencies.requests.remove(request.id);

    return { status: "operator-unavailable" };
  }

  return { status: "pending" };
}
