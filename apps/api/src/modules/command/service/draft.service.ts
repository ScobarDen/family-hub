import type { Message } from "@grammyjs/types";

import { parseCommand, type CommandResult } from "@family-hub/commands";
import { commandDraftLifetimeMs, uuidv7 } from "@family-hub/contract";
import { dateInZone } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";
import type { CommandSource } from "@/common/db";
import { ignoringBotErrors } from "@/common/telegram";

import {
  heardText,
  previewButtons,
  previewText,
  quotaText,
  strangerText,
  unheardText,
  unrecognizedText,
  unsupportedText,
} from "../command.lib.ts";
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

export async function outcomeOf(
  dependencies: CommandDependencies,
  { membership, text }: { membership: Membership; text: string },
): Promise<Outcome> {
  const timeZone = (await dependencies.drafts.timeZoneOf(membership.member.id)) ?? fallbackTimeZone;
  const today = dateInZone(dependencies.clock.now(), timeZone);
  const members = await dependencies.drafts.membersOf(membership.family.id);

  try {
    return await parseCommand(dependencies, {
      text,
      context: {
        today,
        weekday: weekdays.format(new Date(`${today}T12:00:00Z`)),
        timeZone,
        speaker: { id: membership.member.id, name: membership.member.name },
        members,
      },
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return { status: "quota" };
    }

    throw error;
  }
}

// A voice command's answer starts with what the bot heard, so a misheard word is visible.
function withHeard(text: string, heard: string | undefined): string {
  return heard === undefined ? text : `${heardText(heard)}\n\n${text}`;
}

type Answer = {
  membership: Membership;
  chatId: number;
  source: CommandSource;
  outcome: Outcome;
  heard?: string;
};

// Every command handled leaves a row, failed ones too: the rows are the Family's daily count.
async function record(
  dependencies: CommandDependencies,
  { membership, chatId, source, outcome }: Answer,
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

export async function sendPreview(
  dependencies: CommandDependencies,
  answer: Answer,
): Promise<void> {
  const { membership, chatId, outcome, heard } = answer;
  const draftId = await record(dependencies, answer);

  if (outcome.status !== "draft") {
    const texts = {
      quota: quotaText,
      unheard: unheardText,
      unrecognized: unrecognizedText,
      unsupported: unsupportedText,
    };

    await reply(dependencies, { chatId, text: withHeard(texts[outcome.status], heard) });

    return;
  }

  const people = await dependencies.drafts.membersOf(membership.family.id);
  const message = await dependencies.bot.call("sendMessage", {
    chat_id: chatId,
    text: withHeard(previewText(outcome.draft, people), heard),
    reply_markup: previewButtons({ draft: outcome.draft, draftId }, people),
  });

  await dependencies.drafts.update(draftId, {
    messageId: message.message_id,
    updatedAt: dependencies.clock.now(),
  });
}
