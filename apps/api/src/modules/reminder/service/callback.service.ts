import type { CallbackQuery } from "@grammyjs/types";

import type { PushPress } from "@family-hub/contract";

import type { Membership } from "@/modules/auth";
import { ignoringBotErrors } from "@/modules/telegram";

import {
  alreadyDoneText,
  doneText,
  notDoneText,
  notYoursText,
  parseCallback,
  passedText,
  snoozedText,
} from "../reminder.lib.ts";
import type { PushPressClaims, ReminderDependencies, Source } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { fireAfter, zoneOf } from "./schedule.service.ts";
import { sourceOfRow } from "./source.service.ts";

// `occurrence` is the one the pressed message showed; `isClosed` tells it was already done, or for
// a Push also that its source no longer reminds of it.
type Press = {
  row: DispatchRow;
  source: Source;
  presser: Membership;
  occurrence: string | null;
  isClosed: boolean;
};

type Closing = ReminderDependencies & Omit<Press, "isClosed"> & { now: number };

async function closeMessage(closing: Closing, other: DispatchRow) {
  const { dispatch, bot, source, presser, now, occurrence } = closing;

  if (other.chatId !== null && other.messageId !== null) {
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
  }

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
  const closing: Closing = { ...dependencies, ...press, now: dependencies.clock.now() };

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
  { row, source, presser, occurrence }: Press,
): Promise<boolean> {
  const { dispatch, bot, clock } = dependencies;
  const until = clock.now() + source.snoozeMs;
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

  if ((await press.source.complete?.(press.presser, press.occurrence)) === false) {
    return false;
  }

  await markDone(dependencies, { press, rows });

  return true;
}

// Only the Recipient of the row, still a Member of its Family, may press its buttons.
function isRecipient(presser: Membership | undefined, row: DispatchRow): presser is Membership {
  return presser?.member.id === row.memberId && presser.family.id === row.familyId;
}

async function pressedRow(
  dependencies: ReminderDependencies,
  { dispatchId, presser }: { dispatchId: string; presser: Membership | undefined },
): Promise<Omit<Press, "occurrence" | "isClosed"> | undefined> {
  const row = await dependencies.dispatch.find(dispatchId);

  if (row === undefined || !isRecipient(presser, row)) {
    return undefined;
  }

  const source = await sourceOfRow(dependencies, row);

  return source && { row, source, presser };
}

async function pressOf(
  dependencies: ReminderDependencies,
  { dispatchId, telegramId }: { dispatchId: string; telegramId: number },
): Promise<Press | undefined> {
  const presser = await dependencies.memberships.findByTelegramId(telegramId);
  const found = await pressedRow(dependencies, { dispatchId, presser });

  return (
    found && {
      ...found,
      occurrence: found.row.sentOccurrence ?? found.row.occurrence,
      isClosed: found.row.doneAt !== null,
    }
  );
}

// The Occurrence the Push showed is closed once «Готово» marked it on the row or the source no
// longer reminds of it.
function isClosedOn({ row, source }: Pick<Press, "row" | "source">, occurrence: string | null) {
  return (
    (row.sentOccurrence === occurrence && row.doneAt !== null) ||
    (occurrence !== null && source.first(occurrence) !== occurrence)
  );
}

// A signed press whose row or source is gone was answered already: a completed single Task drops
// its rows. The refusal comes back as its text.
async function pushPressOf(
  dependencies: ReminderDependencies,
  { dispatchId, occurrence, memberId }: PushPressClaims,
): Promise<Press | string> {
  const row = await dependencies.dispatch.find(dispatchId);
  const source = row && (await sourceOfRow(dependencies, row));

  if (row === undefined || source === undefined) {
    return alreadyDoneText;
  }

  const presser = await dependencies.memberships.findByMemberId(memberId);

  if (!isRecipient(presser, row)) {
    return notYoursText;
  }

  return { row, source, presser, occurrence, isClosed: isClosedOn({ row, source }, occurrence) };
}

// The text the pressed button answers with, or nothing when it did what it says.
async function pressed(
  dependencies: ReminderDependencies,
  { press, isDone }: { press: Press; isDone: boolean },
): Promise<string | undefined> {
  // Snoozing an Occurrence someone already did would bring it back and push the next one aside.
  if (press.isClosed) {
    return alreadyDoneText;
  }

  if (isDone && press.source.closesForEveryone) {
    return (await didComplete(dependencies, press)) ? undefined : notDoneText;
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

// «Готово» or «Отложить» on a Push: what the bot's buttons do, with the presser read from the
// token instead of Telegram (ADR 0016). A Push left on screen after a later Occurrence was
// delivered may still be done, but snoozing it would push that later one aside.
export async function handlePushPress(
  dependencies: ReminderDependencies,
  { token, action }: PushPress,
): Promise<string | undefined> {
  const claims = await dependencies.push.pressOf(token);
  const press = claims && (await pushPressOf(dependencies, claims));

  if (press === undefined) {
    return notYoursText;
  }

  if (typeof press === "string") {
    return press;
  }

  return action === "snooze" && press.row.sentOccurrence !== press.occurrence
    ? passedText
    : pressed(dependencies, { press, isDone: action === "done" });
}
