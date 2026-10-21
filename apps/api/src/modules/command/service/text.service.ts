import type { Message } from "@grammyjs/types";

import { parseCommand, type CommandResult } from "@family-hub/commands";
import { commandDraftLifetimeMs, uuidv7 } from "@family-hub/contract";
import { dateInZone } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";
import { ignoringBotErrors } from "@/common/telegram";

import {
  previewButtons,
  previewText,
  quotaText,
  strangerText,
  unrecognizedText,
  unsupportedText,
} from "../command.lib.ts";
import type { CommandDependencies } from "../command.types.ts";

const dayMs = 86_400_000;
const fallbackTimeZone = "UTC";
const quotaPattern = /4006|neuron|allocation|quota/iu;

const weekdays = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone: "UTC" });

type Outcome = CommandResult | { status: "quota" };

async function reply(
  { bot }: CommandDependencies,
  { chatId, text }: { chatId: number; text: string },
): Promise<void> {
  await ignoringBotErrors(bot.call("sendMessage", { chat_id: chatId, text }));
}

// Neurons are counted per account from 00:00 UTC; the Family's share resets with them.
async function isOverQuota(
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

async function outcomeOf(
  dependencies: CommandDependencies,
  { membership, text, timeZone }: { membership: Membership; text: string; timeZone: string },
): Promise<Outcome> {
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
    if (error instanceof Error && quotaPattern.test(error.message)) {
      return { status: "quota" };
    }

    throw error;
  }
}

async function sendPreview(
  dependencies: CommandDependencies,
  { membership, chatId, outcome }: { membership: Membership; chatId: number; outcome: Outcome },
): Promise<void> {
  const now = dependencies.clock.now();
  const draftId = uuidv7(now);
  const isDraft = outcome.status === "draft";

  await dependencies.drafts.add({
    id: draftId,
    familyId: membership.family.id,
    memberId: membership.member.id,
    kind: isDraft ? outcome.draft.kind : null,
    payload: isDraft ? outcome.draft : null,
    source: "bot_text",
    chatId,
    status: isDraft ? "pending" : "failed",
    expiresAt: now + commandDraftLifetimeMs,
    createdAt: now,
    updatedAt: now,
  });

  if (!isDraft) {
    const texts = {
      quota: quotaText,
      unrecognized: unrecognizedText,
      unsupported: unsupportedText,
    };

    await reply(dependencies, { chatId, text: texts[outcome.status] });

    return;
  }

  const people = await dependencies.drafts.membersOf(membership.family.id);
  const message = await dependencies.bot.call("sendMessage", {
    chat_id: chatId,
    text: previewText(outcome.draft, people),
    reply_markup: previewButtons({ draft: outcome.draft, draftId }, people),
  });

  await dependencies.drafts.update(draftId, { messageId: message.message_id, updatedAt: now });
}

// A Member writes the bot a plain message; it answers with a draft to confirm, never a record.
export async function handleText(
  dependencies: CommandDependencies,
  message: Message,
): Promise<void> {
  const chatId = message.chat.id;
  const text = message.text ?? "";
  const membership =
    message.from && (await dependencies.memberships.findByTelegramId(message.from.id));

  if (membership === undefined) {
    await reply(dependencies, { chatId, text: strangerText });

    return;
  }

  if (await isOverQuota(dependencies, membership)) {
    await reply(dependencies, { chatId, text: quotaText });

    return;
  }

  await ignoringBotErrors(
    dependencies.bot.call("sendChatAction", { chat_id: chatId, action: "typing" }),
  );

  const timeZone = (await dependencies.drafts.timeZoneOf(membership.member.id)) ?? fallbackTimeZone;
  const outcome = await outcomeOf(dependencies, { membership, text, timeZone });

  await sendPreview(dependencies, { membership, chatId, outcome });
}
