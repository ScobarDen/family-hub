import type { Message } from "@grammyjs/types";

import { parseCommand, type CommandResult } from "@family-hub/commands";
import { commandDraftLifetimeMs, uuidv7 } from "@family-hub/contract";
import { dateInZone, type Phrase } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";
import { fallbackTimeZone } from "@/common/clock";
import type { CommandSource } from "@/common/db";
import { ignoringBotErrors } from "@/common/telegram";

import { previewText } from "../command-preview.lib.ts";
import { failureTexts, heardText, previewButtons, strangerText } from "../command.lib.ts";
import type { FamilyNames } from "../command.repo.ts";
import type { CommandDependencies } from "../command.types.ts";

const dayMs = 86_400_000;
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

export async function showTyping({ bot }: CommandDependencies, chatId: number): Promise<void> {
  await ignoringBotErrors(bot.call("sendChatAction", { chat_id: chatId, action: "typing" }));
}

export async function editLinkOf(
  { appLinks }: CommandDependencies,
  draftId: string,
): Promise<string> {
  return appLinks.appLink({ kind: "cmd", id: draftId });
}

export async function namesOf(
  { drafts }: CommandDependencies,
  familyId: string,
): Promise<FamilyNames> {
  return { members: await drafts.membersOf(familyId), pets: await drafts.petsOf(familyId) };
}

export function speakerZoneOf({ member }: Membership): string {
  return member.timeZone ?? fallbackTimeZone;
}

export async function outcomeOf(
  dependencies: CommandDependencies,
  { membership, text }: { membership: Membership; text: string },
): Promise<Outcome> {
  const timeZone = speakerZoneOf(membership);
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

type Reservation = { draftId: string; phrase: Phrase };

type Speaking = { membership: Membership; chatId: number | null; source: CommandSource };

// Every command handled leaves a row, failed ones too: the rows are the Family's daily count.
// The row is taken before the model runs, so commands sent at once cannot all slip under the
// limit; neurons are counted per account from 00:00 UTC and the Family's share resets with them.
// The row's moment and zone are the phrase's, which «Создать» later reads the draft's dates in.
export async function reserve(
  dependencies: CommandDependencies,
  { membership, chatId, source }: Speaking,
): Promise<Reservation | undefined> {
  const now = dependencies.clock.now();
  const draftId = uuidv7(now);
  const timeZone = speakerZoneOf(membership);
  const reserved = await dependencies.drafts.reserve(
    {
      id: draftId,
      familyId: membership.family.id,
      memberId: membership.member.id,
      source,
      chatId,
      timeZone,
      status: "failed",
      expiresAt: now + commandDraftLifetimeMs,
      createdAt: now,
      updatedAt: now,
    },
    { since: now - (now % dayMs), limit: dependencies.commandsPerFamilyDay },
  );

  return reserved === "reserved" ? { draftId, phrase: { saidAt: now, timeZone } } : undefined;
}

export async function record(
  dependencies: CommandDependencies,
  { reservation, outcome }: { reservation: Reservation; outcome: Outcome },
): Promise<void> {
  if (outcome.status === "draft") {
    await dependencies.drafts.update(reservation.draftId, {
      kind: outcome.draft.kind,
      payload: outcome.draft,
      status: "pending",
      updatedAt: dependencies.clock.now(),
    });
  }
}

type Handled = {
  membership: Membership;
  chatId: number;
  reservation: Reservation;
  outcome: Outcome;
};

// A voice command's answer starts with what the bot heard, so a misheard word is visible.
function withHeard(text: string, heard: string | undefined): string {
  return heard === undefined ? text : `${heardText(heard)}\n\n${text}`;
}

export async function sendPreview(
  dependencies: CommandDependencies,
  answer: Handled & { heard?: string },
): Promise<void> {
  const { membership, chatId, outcome, heard, reservation } = answer;
  const { draftId } = reservation;

  await record(dependencies, answer);

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
