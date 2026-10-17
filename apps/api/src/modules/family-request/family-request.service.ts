import type { CallbackQuery } from "@grammyjs/types";

import { uuidv7 } from "@family-hub/contract";

import type { MembershipRepo, TelegramUser } from "@/common/auth";
import type { Clock } from "@/common/clock";
import { BotApiError, type BotApi } from "@/common/telegram";

import { familyRequestCooldownMs } from "./family-request.config.ts";
import {
  approvedText,
  decisionButtons,
  displayName,
  operatorText,
  outcomeNote,
  parseCallback,
  rejectedText,
  type Decision,
} from "./family-request.lib.ts";
import type { FamilyRequest, FamilyRequestRepo } from "./family-request.repo.ts";

export type SubmitResult =
  | { status: "pending" }
  | { status: "already-member" }
  | { status: "already-pending" }
  | { status: "cooldown" }
  | { status: "operator-unavailable" };

type DecidedOutcome = keyof typeof outcomeNote;
type Outcome = DecidedOutcome | "already-decided";

type FamilyRequestDependencies = {
  requests: FamilyRequestRepo;
  memberships: MembershipRepo;
  bot: BotApi;
  clock: Clock;
  operatorTelegramId: number;
};

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

function newRequest(user: TelegramUser, familyName: string, now: number): FamilyRequest {
  return {
    id: uuidv7(now),
    telegramId: user.id,
    familyName,
    requesterName: displayName(user),
    requesterUsername: user.username ?? null,
    status: "pending",
    createdAt: now,
    decidedAt: null,
    updatedAt: now,
  };
}

async function submit(
  dependencies: FamilyRequestDependencies,
  user: TelegramUser,
  familyName: string,
): Promise<SubmitResult> {
  const refused = await refusal(dependencies, user.id);

  if (refused) {
    return refused;
  }

  const request = newRequest(user, familyName, dependencies.clock.now());

  await dependencies.requests.add(request);

  try {
    await sendToOperator(dependencies, request);
  } catch {
    await dependencies.requests.remove(request.id);

    return { status: "operator-unavailable" };
  }

  return { status: "pending" };
}

async function notifyRequester(
  { bot }: FamilyRequestDependencies,
  request: FamilyRequest,
  text: string,
) {
  try {
    await bot.call("sendMessage", { chat_id: request.telegramId, text });
  } catch (error) {
    // A requester who denied write access still gets in by reopening the app.
    if (!(error instanceof BotApiError)) {
      throw error;
    }
  }
}

async function approve(
  dependencies: FamilyRequestDependencies,
  request: FamilyRequest,
): Promise<Outcome> {
  const { memberships, requests, clock } = dependencies;
  const now = clock.now();

  if (await memberships.findByTelegramId(request.telegramId)) {
    const stale = await requests.decide(request.id, "stale", now);

    return stale === undefined ? "already-decided" : "stale";
  }

  await requests.approve({ request, familyId: uuidv7(now), newMemberId: uuidv7(now), now });
  await notifyRequester(dependencies, request, approvedText(request));

  return "approved";
}

async function reject(
  dependencies: FamilyRequestDependencies,
  request: FamilyRequest,
): Promise<Outcome> {
  const rejected = await dependencies.requests.decide(
    request.id,
    "rejected",
    dependencies.clock.now(),
  );

  if (rejected === undefined) {
    return "already-decided";
  }

  await notifyRequester(dependencies, request, rejectedText(request));

  return "rejected";
}

async function decide(
  dependencies: FamilyRequestDependencies,
  requestId: string,
  decision: Decision,
): Promise<Outcome> {
  const request = await dependencies.requests.findById(requestId);

  if (request?.status !== "pending") {
    return "already-decided";
  }

  return decision === "approve" ? approve(dependencies, request) : reject(dependencies, request);
}

async function markDecided(
  { bot }: FamilyRequestDependencies,
  query: CallbackQuery,
  outcome: DecidedOutcome,
) {
  const message = query.message;

  if (message === undefined || !("text" in message)) {
    return;
  }

  await bot.call("editMessageText", {
    chat_id: message.chat.id,
    message_id: message.message_id,
    text: `${message.text}

${outcomeNote[outcome]}`,
  });
}

async function answer(
  { bot }: FamilyRequestDependencies,
  query: CallbackQuery,
  text?: string,
): Promise<void> {
  await bot.call("answerCallbackQuery", {
    callback_query_id: query.id,
    ...(text === undefined ? {} : { text }),
  });
}

async function handleCallback(
  dependencies: FamilyRequestDependencies,
  query: CallbackQuery,
): Promise<void> {
  const callback = parseCallback(query.data);

  if (!callback) {
    return;
  }

  if (query.from.id !== dependencies.operatorTelegramId) {
    await answer(dependencies, query, "Это может сделать только Operator");

    return;
  }

  const outcome = await decide(dependencies, callback.requestId, callback.decision);

  if (outcome === "already-decided") {
    await answer(dependencies, query, "Заявка уже рассмотрена");

    return;
  }

  await markDecided(dependencies, query, outcome);
  await answer(dependencies, query);
}

export function createFamilyRequestService(dependencies: FamilyRequestDependencies) {
  return {
    submit: async (user: TelegramUser, familyName: string) =>
      submit(dependencies, user, familyName),
    handleCallback: async (query: CallbackQuery) => handleCallback(dependencies, query),
  };
}

export type FamilyRequestService = ReturnType<typeof createFamilyRequestService>;
