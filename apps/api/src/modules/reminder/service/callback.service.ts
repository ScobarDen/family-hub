import type { CallbackQuery } from "@grammyjs/types";

import type { Membership } from "@/common/auth";
import { ignoringBotErrors } from "@/common/telegram";

import {
  doneText,
  fireAfter,
  notYoursText,
  parseCallback,
  snoozedText,
  snoozeMs,
} from "../reminder.lib.ts";
import type { ReminderDependencies } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import type { ReminderRow } from "../repo/reminder.repo.ts";

type Press = { row: DispatchRow; reminder: ReminderRow; presser: Membership };

type Closing = ReminderDependencies & Press & { occurrence: string | null; now: number };

async function closeMessage(
  { dispatch, bot, reminder, presser, now }: Closing,
  other: DispatchRow,
) {
  if (other.chatId === null || other.messageId === null) {
    return;
  }

  await ignoringBotErrors(
    bot.call("editMessageText", {
      chat_id: other.chatId,
      message_id: other.messageId,
      text: doneText({ text: reminder.text, doneBy: presser.member.name }),
    }),
  );
  await dispatch.update(other.id, { doneAt: now, doneBy: presser.member.id, updatedAt: now });
}

async function moveOn({ dispatch, reminder, occurrence, now }: Closing, other: DispatchRow) {
  const next = occurrence === null ? undefined : fireAfter(reminder, occurrence);

  await dispatch.update(other.id, {
    occurrence: next?.occurrence ?? null,
    nextFireAt: next?.fireAt ?? null,
    updatedAt: now,
  });
}

// «Готово» closes the Occurrence for every Recipient: sent messages turn into «Сделал(а) …» and
// rows still waiting for it move on.
async function markDone(dependencies: ReminderDependencies, press: Press) {
  const { row } = press;
  const closing: Closing = {
    ...dependencies,
    ...press,
    occurrence: row.sentOccurrence ?? row.occurrence,
    now: dependencies.clock.now(),
  };
  const rows = await dependencies.dispatch.ofSource({
    familyId: row.familyId,
    sourceId: row.sourceId,
  });

  for (const other of rows) {
    if (other.sentOccurrence === closing.occurrence) {
      await closeMessage(closing, other);
    }

    if (closing.occurrence !== null && other.occurrence === closing.occurrence) {
      await moveOn(closing, other);
    }
  }
}

// «Отложить» is the presser's own: their row comes back for the same Occurrence in an hour.
async function snooze(
  { dispatch, reminders, bot, clock }: ReminderDependencies,
  { row, reminder, presser }: Press,
) {
  const until = clock.now() + snoozeMs;
  const timeZone = (await reminders.timeZoneOf(presser.member.id)) ?? reminder.timeZone;

  await dispatch.update(row.id, {
    occurrence: row.sentOccurrence ?? row.occurrence,
    nextFireAt: until,
    updatedAt: clock.now(),
  });

  if (row.chatId !== null && row.messageId !== null) {
    await ignoringBotErrors(
      bot.call("editMessageText", {
        chat_id: row.chatId,
        message_id: row.messageId,
        text: snoozedText({ text: reminder.text, until, timeZone }),
      }),
    );
  }
}

async function pressOf(
  { dispatch, reminders, memberships }: ReminderDependencies,
  { dispatchId, telegramId }: { dispatchId: string; telegramId: number },
): Promise<Press | undefined> {
  const row = await dispatch.find(dispatchId);
  const presser = await memberships.findByTelegramId(telegramId);

  if (row === undefined || presser?.member.id !== row.memberId) {
    return undefined;
  }

  const entry = await reminders.findById(row.sourceId);

  return entry && { row, reminder: entry.reminder, presser };
}

export async function handleReminderCallback(
  dependencies: ReminderDependencies,
  query: CallbackQuery,
): Promise<void> {
  const parsed = parseCallback(query.data);
  const press =
    parsed &&
    (await pressOf(dependencies, { dispatchId: parsed.dispatchId, telegramId: query.from.id }));

  if (parsed === undefined || press === undefined) {
    await ignoringBotErrors(
      dependencies.bot.call("answerCallbackQuery", {
        callback_query_id: query.id,
        text: notYoursText,
      }),
    );

    return;
  }

  await (parsed.action === "done" ? markDone(dependencies, press) : snooze(dependencies, press));
  await ignoringBotErrors(
    dependencies.bot.call("answerCallbackQuery", { callback_query_id: query.id }),
  );
}
