import type { CallbackQuery } from "@grammyjs/types";

import { uuidv7 } from "@family-hub/contract";

import { ignoringBotErrors, type BotParams } from "@/common/telegram";

import {
  approvedMessage,
  outcomeNote,
  parseCallback,
  rejectedText,
  type OperatorChoice,
} from "../family-request.lib.ts";
import type { FamilyRequest } from "../family-request.repo.ts";
import type { FamilyRequestDependencies } from "../family-request.types.ts";

type DecidedOutcome = keyof typeof outcomeNote;
type Outcome = DecidedOutcome | "already-decided";

async function notifyRequester(
  { bot }: FamilyRequestDependencies,
  request: FamilyRequest,
  message: Omit<BotParams<"sendMessage">, "chat_id">,
) {
  await ignoringBotErrors(bot.call("sendMessage", { chat_id: request.telegramId, ...message }));
}

async function createFamilyFor(
  { requests }: FamilyRequestDependencies,
  request: FamilyRequest,
  now: number,
): Promise<void> {
  try {
    await requests.createFamily({ request, familyId: uuidv7(now), newMemberId: uuidv7(now), now });
  } catch (error) {
    await requests.reopen(request.id, now);
    throw error;
  }
}

async function approve(
  dependencies: FamilyRequestDependencies,
  request: FamilyRequest,
): Promise<Outcome> {
  const { memberships, requests, clock } = dependencies;
  const now = clock.now();

  if (await memberships.findByTelegramId(request.telegramId)) {
    const stale = await requests.close(request.id, "stale", now);

    return stale === undefined ? "already-decided" : "stale";
  }

  if ((await requests.close(request.id, "approved", now)) === undefined) {
    return "already-decided";
  }

  await createFamilyFor(dependencies, request, now);
  await notifyRequester(dependencies, request, approvedMessage(request, dependencies.miniAppUrl));

  return "approved";
}

async function reject(
  dependencies: FamilyRequestDependencies,
  request: FamilyRequest,
): Promise<Outcome> {
  const rejected = await dependencies.requests.close(
    request.id,
    "rejected",
    dependencies.clock.now(),
  );

  if (rejected === undefined) {
    return "already-decided";
  }

  await notifyRequester(dependencies, request, { text: rejectedText(request) });

  return "rejected";
}

async function decide(
  dependencies: FamilyRequestDependencies,
  requestId: string,
  choice: OperatorChoice,
): Promise<Outcome> {
  const request = await dependencies.requests.findById(requestId);

  if (request?.status !== "pending") {
    return "already-decided";
  }

  return choice === "approve" ? approve(dependencies, request) : reject(dependencies, request);
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

  await ignoringBotErrors(
    bot.call("editMessageText", {
      chat_id: message.chat.id,
      message_id: message.message_id,
      text: [message.text, outcomeNote[outcome]].join("\n\n"),
    }),
  );
}

async function answer(
  { bot }: FamilyRequestDependencies,
  query: CallbackQuery,
  text?: string,
): Promise<void> {
  await ignoringBotErrors(
    bot.call("answerCallbackQuery", {
      callback_query_id: query.id,
      ...(text === undefined ? {} : { text }),
    }),
  );
}

export async function handleCallback(
  dependencies: FamilyRequestDependencies,
  query: CallbackQuery,
): Promise<void> {
  const callback = parseCallback(query.data);

  if (!callback) {
    return;
  }

  if (query.from.id !== dependencies.operatorTelegramId) {
    await answer(dependencies, query, "Это может сделать только администратор");

    return;
  }

  const outcome = await decide(dependencies, callback.requestId, callback.choice);

  if (outcome === "already-decided") {
    await answer(dependencies, query, "Заявка уже рассмотрена");

    return;
  }

  await markDecided(dependencies, query, outcome);
  await answer(dependencies, query);
}
