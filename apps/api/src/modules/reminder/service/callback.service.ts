import type { CallbackQuery } from "@grammyjs/types";

import type { Membership } from "@/modules/auth";
import { ignoringBotErrors } from "@/modules/telegram";

import {
  alreadyDoneText,
  doneText,
  notDoneText,
  notYoursText,
  parseCallback,
  snoozedText,
} from "../reminder.lib.ts";
import type { ReminderDependencies, Source } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { fireAfter, zoneOf } from "./schedule.service.ts";
import { sourceOfRow } from "./source.service.ts";

type Press = { row: DispatchRow; source: Source; presser: Membership };

type Closing = ReminderDependencies & Press & { occurrence: string | null; now: number };

async function closeMessage(closing: Closing, other: DispatchRow) {
  const { dispatch, bot, source, presser, now, occurrence } = closing;

  if (other.chatId === null || other.messageId === null) {
    return;
  }

  await ignoringBotErrors(
    bot.call("editMessageText", {
      chat_id: other.chatId,
      message_id: other.messageId,
      text: doneText({
        text: source.title(
          occurrence ?? "",
          await zoneOf(closing, { memberId: other.memberId, source }),
        ),
        doneBy: presser.member.name,
      }),
    }),
  );
  await dispatch.update(other.familyId, other.id, {
    doneAt: now,
    doneBy: presser.member.id,
    updatedAt: now,
  });
}

async function moveOn(closing: Closing, other: DispatchRow) {
  const { dispatch, source, occurrence, now } = closing;
  const next =
    occurrence === null
      ? undefined
      : fireAfter(source, {
          occurrence,
          timeZone: await zoneOf(closing, { memberId: other.memberId, source }),
        });

  await dispatch.update(other.familyId, other.id, {
    occurrence: next?.occurrence ?? null,
    nextFireAt: next?.fireAt ?? null,
    updatedAt: now,
  });
}

// «Готово» closes the Occurrence for every Recipient: sent messages turn into «Сделал(а) …» and
// rows still waiting for it move on.
async function markDone(
  dependencies: ReminderDependencies,
  { press, rows }: { press: Press; rows: DispatchRow[] },
) {
  const { row } = press;
  const closing: Closing = {
    ...dependencies,
    ...press,
    occurrence: row.sentOccurrence ?? row.occurrence,
    now: dependencies.clock.now(),
  };

  for (const other of rows) {
    if (other.sentOccurrence === closing.occurrence) {
      await closeMessage(closing, other);
    }

    if (closing.occurrence !== null && other.occurrence === closing.occurrence) {
      await moveOn(closing, other);
    }
  }
}

// «Отложить» is the presser's own: their row comes back for the same Occurrence later.
async function didSnooze(
  dependencies: ReminderDependencies,
  { row, source, presser }: Press,
): Promise<boolean> {
  const { dispatch, bot, clock } = dependencies;
  const until = clock.now() + source.snoozeMs;
  const occurrence = row.sentOccurrence ?? row.occurrence;
  const timeZone = await zoneOf(dependencies, { memberId: presser.member.id, source });

  await dispatch.update(row.familyId, row.id, {
    occurrence,
    nextFireAt: until,
    updatedAt: clock.now(),
  });

  if (row.chatId !== null && row.messageId !== null) {
    await ignoringBotErrors(
      bot.call("editMessageText", {
        chat_id: row.chatId,
        message_id: row.messageId,
        text: snoozedText({ text: source.title(occurrence ?? "", timeZone), until, timeZone }),
      }),
    );
  }

  return true;
}

// The source closes first, so a message never says «Сделал(а)» about what the app still shows open;
// its rows are read before, as completing a single Task drops them.
async function didComplete(dependencies: ReminderDependencies, press: Press): Promise<boolean> {
  const rows = await dependencies.dispatch.ofSource(press.row);
  const occurrence = press.row.sentOccurrence ?? press.row.occurrence;

  if ((await press.source.complete?.(press.presser, occurrence)) === false) {
    return false;
  }

  await markDone(dependencies, { press, rows });

  return true;
}

async function pressOf(
  dependencies: ReminderDependencies,
  { dispatchId, telegramId }: { dispatchId: string; telegramId: number },
): Promise<Press | undefined> {
  const row = await dependencies.dispatch.find(dispatchId);
  const presser = await dependencies.memberships.findByTelegramId(telegramId);

  if (
    row === undefined ||
    presser?.member.id !== row.memberId ||
    presser.family.id !== row.familyId
  ) {
    return undefined;
  }

  const source = await sourceOfRow(dependencies, row);

  return source && { row, source, presser };
}

// The text the pressed button answers with, or nothing when it did what it says.
async function pressed(
  dependencies: ReminderDependencies,
  { press, isDone }: { press: Press; isDone: boolean },
): Promise<string | undefined> {
  if (isDone && press.source.closesForEveryone) {
    return (await didComplete(dependencies, press)) ? undefined : notDoneText;
  }

  // Snoozing an Occurrence someone already did would bring it back and push the next one aside.
  if (!isDone && press.row.doneAt !== null) {
    return alreadyDoneText;
  }

  await didSnooze(dependencies, press);

  return undefined;
}

export async function handleReminderCallback(
  dependencies: ReminderDependencies,
  query: CallbackQuery,
): Promise<void> {
  const parsed = parseCallback(query.data);
  const press =
    parsed &&
    (await pressOf(dependencies, { dispatchId: parsed.dispatchId, telegramId: query.from.id }));
  const text =
    parsed === undefined || press === undefined
      ? notYoursText
      : await pressed(dependencies, { press, isDone: parsed.action === "done" });

  await ignoringBotErrors(
    dependencies.bot.call(
      "answerCallbackQuery",
      text === undefined ? { callback_query_id: query.id } : { callback_query_id: query.id, text },
    ),
  );
}
