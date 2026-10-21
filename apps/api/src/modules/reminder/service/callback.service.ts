import type { CallbackQuery } from "@grammyjs/types";

import type { Membership } from "@/common/auth";
import { ignoringBotErrors } from "@/common/telegram";

import { doneText, notYoursText, parseCallback, snoozedText } from "../reminder.lib.ts";
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
  await dispatch.update(other.id, { doneAt: now, doneBy: presser.member.id, updatedAt: now });
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
    source: row.source,
    prefix: row.sourceId,
  });

  for (const other of rows.filter(({ sourceId }) => sourceId === row.sourceId)) {
    if (other.sentOccurrence === closing.occurrence) {
      await closeMessage(closing, other);
    }

    if (closing.occurrence !== null && other.occurrence === closing.occurrence) {
      await moveOn(closing, other);
    }
  }
}

// «Отложить» is the presser's own: their row comes back for the same Occurrence later.
async function snooze(dependencies: ReminderDependencies, { row, source, presser }: Press) {
  const { dispatch, bot, clock } = dependencies;
  const until = clock.now() + source.snoozeMs;
  const occurrence = row.sentOccurrence ?? row.occurrence;
  const timeZone = await zoneOf(dependencies, { memberId: presser.member.id, source });

  await dispatch.update(row.id, { occurrence, nextFireAt: until, updatedAt: clock.now() });

  if (row.chatId !== null && row.messageId !== null) {
    await ignoringBotErrors(
      bot.call("editMessageText", {
        chat_id: row.chatId,
        message_id: row.messageId,
        text: snoozedText({ text: source.title(occurrence ?? "", timeZone), until, timeZone }),
      }),
    );
  }
}

async function pressOf(
  dependencies: ReminderDependencies,
  { dispatchId, telegramId }: { dispatchId: string; telegramId: number },
): Promise<Press | undefined> {
  const row = await dependencies.dispatch.find(dispatchId);
  const presser = await dependencies.memberships.findByTelegramId(telegramId);

  if (row === undefined || presser?.member.id !== row.memberId) {
    return undefined;
  }

  const source = await sourceOfRow(dependencies, row);

  return source && { row, source, presser };
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

  await (parsed.action === "done" && press.source.closesForEveryone
    ? markDone(dependencies, press)
    : snooze(dependencies, press));
  await ignoringBotErrors(
    dependencies.bot.call("answerCallbackQuery", { callback_query_id: query.id }),
  );
}
