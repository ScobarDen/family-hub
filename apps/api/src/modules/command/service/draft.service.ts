import type { Message } from "@grammyjs/types";

import { parseCommand, type CommandResult } from "@family-hub/commands";
import { commandDraftLifetimeMs, uuidv7 } from "@family-hub/contract";
import { dateInZone } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";
import type { CommandSource } from "@/common/db";
import { ignoringBotErrors } from "@/common/telegram";

import { previewText } from "../command-preview.lib.ts";
import { editLink, failureTexts, heardText, previewButtons, strangerText } from "../command.lib.ts";
import type { FamilyNames } from "../command.repo.ts";
import type { CommandDependencies } from "../command.types.ts";

const dayMs = 86_400_000;
const fallbackTimeZone = "UTC";
const quotaPattern = /4006|neuron|allocation|quota/iu;

const weekdays = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone: "UTC" });

export type Outcome = CommandResult | { status: "quota" } | { status: "unheard" };

export function isQuotaError(error: unknown): boolean {
  return error instanceof Error && quotaPattern.test(error.message);
}

export async function reply(
  { bot }: CommandDependencies,
  { chatId, text }: { chatId: number; text: string },
): Promise<void> {
  await ignoringBotErrors(bot.call("sendMessage", { chat_id: chatId, text }));
}

export async function membershipOf(
  dependencies: CommandDependencies,
  message: Message,
): Promise<Membership | undefined> {
  const membership =
    message.from && (await dependencies.memberships.findByTelegramId(message.from.id));

  if (membership === undefined) {
    await reply(dependencies, { chatId: message.chat.id, text: strangerText });
  }

  return membership;
}

// Neurons are counted per account from 00:00 UTC; the Family's share resets with them.
export async function isOverQuota(
  dependencies: CommandDependencies,
  { family }: Membership,
): Promise<boolean> {
  const now = dependencies.clock.now();
  const count = await dependencies.drafts.countSince({
    familyId: family.id,
    since: now - (now % dayMs),
  });

  return count >= dependencies.commandsPerFamilyDay;
}

export async function showTyping({ bot }: CommandDependencies, chatId: number): Promise<void> {
  await ignoringBotErrors(bot.call("sendChatAction", { chat_id: chatId, action: "typing" }));
}

export async function editLinkOf({ bot }: CommandDependencies, draftId: string): Promise<string> {
  // oxlint-disable-next-line unicorn/no-useless-undefined -- BotApi.call always takes params; getMe has none
  const { username } = await bot.call("getMe", undefined);

  return editLink(username, draftId);
}

export async function namesOf(
  { drafts }: CommandDependencies,
  familyId: string,
): Promise<FamilyNames> {
  return { members: await drafts.membersOf(familyId), pets: await drafts.petsOf(familyId) };
}

export async function outcomeOf(
  dependencies: CommandDependencies,
  { membership, text }: { membership: Membership; text: string },
): Promise<Outcome> {
  const timeZone = (await dependencies.drafts.timeZoneOf(membership.member.id)) ?? fallbackTimeZone;
  const today = dateInZone(dependencies.clock.now(), timeZone);
  const { members, pets } = await namesOf(dependencies, membership.family.id);

  try {
    return await parseCommand(dependencies, {
      text,
      context: {
        today,
        weekday: weekdays.format(new Date(`${today}T12:00:00Z`)),
        timeZone,
        speaker: { id: membership.member.id, name: membership.member.name },
        members,
        pets,
      },
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return { status: "quota" };
    }

    throw error;
  }
}

type Handled = {
  membership: Membership;
  chatId: number | null;
  source: CommandSource;
  outcome: Outcome;
};

// Every command handled leaves a row, failed ones too: the rows are the Family's daily count.
export async function record(
  dependencies: CommandDependencies,
  { membership, chatId, source, outcome }: Handled,
): Promise<string> {
  const now = dependencies.clock.now();
  const draftId = uuidv7(now);
  const isDraft = outcome.status === "draft";

  await dependencies.drafts.add({
    id: draftId,
    familyId: membership.family.id,
    memberId: membership.member.id,
    kind: isDraft ? outcome.draft.kind : null,
    payload: isDraft ? outcome.draft : null,
    source,
    chatId,
    status: isDraft ? "pending" : "failed",
    expiresAt: now + commandDraftLifetimeMs,
    createdAt: now,
    updatedAt: now,
  });

  return draftId;
}

// A voice command's answer starts with what the bot heard, so a misheard word is visible.
function withHeard(text: string, heard: string | undefined): string {
  return heard === undefined ? text : `${heardText(heard)}\n\n${text}`;
}

export async function sendPreview(
  dependencies: CommandDependencies,
  answer: Handled & { chatId: number; heard?: string },
): Promise<void> {
  const { membership, chatId, outcome, heard } = answer;
  const draftId = await record(dependencies, answer);

  if (outcome.status !== "draft") {
    await reply(dependencies, { chatId, text: withHeard(failureTexts[outcome.status], heard) });

    return;
  }

  const names = await namesOf(dependencies, membership.family.id);
  const message = await dependencies.bot.call("sendMessage", {
    chat_id: chatId,
    text: withHeard(previewText(outcome.draft, names), heard),
    reply_markup: previewButtons(
      { draft: outcome.draft, draftId, editLink: await editLinkOf(dependencies, draftId) },
      names,
    ),
  });

  await dependencies.drafts.update(draftId, {
    messageId: message.message_id,
    updatedAt: dependencies.clock.now(),
  });
}
