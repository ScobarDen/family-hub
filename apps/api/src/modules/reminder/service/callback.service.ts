import type { CallbackQuery } from "@grammyjs/types";

import type { PushPress } from "@family-hub/contract";

import type { Membership } from "@/modules/auth";
import { ignoringBotErrors } from "@/modules/telegram";

import {
  alreadyDoneText,
  holderIdOf,
  notDoneText,
  notYoursText,
  parseCallback,
  passedText,
  snoozedText,
} from "../reminder.lib.ts";
import type {
  PushPressClaims,
  ReminderDependencies,
  Source,
  TaskCompletion,
} from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { closeOccurrence } from "./closing.service.ts";
import { zoneOf } from "./schedule.service.ts";
import { sourceOfRow } from "./source.service.ts";

// `occurrence` is the one the pressed message showed; `isClosed` tells it was already done, skipped
// or is no longer one its source reminds of.
type Press = {
  row: DispatchRow;
  source: Source;
  presser: Membership;
  occurrence: string | null;
  isClosed: boolean;
};

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

// A Task completes in the task module, which tells every row of its Occurrence; a source with no
// module of its own closes its rows here.
async function didComplete(
  dependencies: ReminderDependencies,
  { press, tasks }: { press: Press; tasks: TaskCompletion },
): Promise<boolean> {
  const { row, source, presser, occurrence } = press;

  if (source.kind === "task") {
    const { status } = await tasks.complete(presser, {
      taskId: holderIdOf(row.sourceId),
      occurrence,
    });

    return status === "ok";
  }

  await closeOccurrence(dependencies, {
    rows: await dependencies.dispatch.ofSource(row),
    occurrence,
    by: presser.member,
    sourceOf: () => source,
  });

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

  const occurrence = found?.row.sentOccurrence ?? found?.row.occurrence ?? null;

  return found && { ...found, occurrence, isClosed: isClosedOn(found, occurrence) };
}

// The one rule for the bot and a Push: the source tells, or the mark «Готово» left on the row.
function isClosedOn({ row, source }: Pick<Press, "row" | "source">, occurrence: string | null) {
  return occurrence !== null && source.isClosed !== undefined
    ? source.isClosed(occurrence)
    : row.sentOccurrence === occurrence && row.doneAt !== null;
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
  { press, isDone, tasks }: { press: Press; isDone: boolean; tasks: TaskCompletion },
): Promise<string | undefined> {
  // Snoozing an Occurrence someone already did would bring it back and push the next one aside.
  if (press.isClosed) {
    return alreadyDoneText;
  }

  if (isDone && press.source.closesForEveryone) {
    return (await didComplete(dependencies, { press, tasks })) ? undefined : notDoneText;
  }

  await didSnooze(dependencies, press);

  return undefined;
}

export async function handleReminderCallback(
  dependencies: ReminderDependencies,
  query: CallbackQuery,
  tasks: TaskCompletion,
): Promise<void> {
  const parsed = parseCallback(query.data);
  const press =
    parsed &&
    (await pressOf(dependencies, { dispatchId: parsed.dispatchId, telegramId: query.from.id }));
  const text =
    parsed === undefined || press === undefined
      ? notYoursText
      : await pressed(dependencies, { press, isDone: parsed.action === "done", tasks });

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
  tasks: TaskCompletion,
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
    : pressed(dependencies, { press, isDone: action === "done", tasks });
}
