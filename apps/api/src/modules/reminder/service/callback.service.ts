import type { CallbackQuery } from "@grammyjs/types";

import type { PushPress } from "@family-hub/contract";

import type { Membership } from "@/modules/auth";
import { ignoringBotErrors } from "@/modules/telegram";

import type { PressOutcome } from "../lib/recipient-reminder.lib.ts";
import { alreadyDoneText, notDoneText, notYoursText, parseCallback } from "../lib/reminder.lib.ts";
import type {
  PushPressClaims,
  ReminderDependencies,
  ReminderSource,
  TaskCompletion,
} from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { closeOccurrence } from "./closing.service.ts";
import { editMessage, reminderOfRow } from "./recipient-reminder.service.ts";
import { sourceOfRow } from "./source.service.ts";

type Press = {
  row: DispatchRow;
  source: ReminderSource;
  presser: Membership;
  occurrence: string | null;
  occurrenceFrom: "message" | "row";
};

type Pressing = {
  press: Press;
  action: "done" | "snooze";
  tasks: TaskCompletion;
};

// Only the Recipient of the row, still a Member of its Family, may press its buttons.
function isRecipient(presser: Membership | undefined, row: DispatchRow): presser is Membership {
  return presser?.member.id === row.memberId && presser.family.id === row.familyId;
}

async function botPressOf(
  dependencies: ReminderDependencies,
  {
    dispatchId,
    occurrence,
    telegramId,
  }: { dispatchId: string; occurrence: string | undefined; telegramId: number },
): Promise<Press | undefined> {
  const presser = await dependencies.memberships.findByTelegramId(telegramId);
  const row = await dependencies.dispatch.find(dispatchId);

  if (row === undefined || !isRecipient(presser, row)) {
    return undefined;
  }

  const source = await sourceOfRow(dependencies, row);
  const pressedOccurrence =
    occurrence === undefined
      ? { occurrence: row.sentOccurrence ?? row.occurrence, occurrenceFrom: "row" as const }
      : { occurrence, occurrenceFrom: "message" as const };

  return source && { row, source, presser, ...pressedOccurrence };
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

  return isRecipient(presser, row)
    ? { row, source, presser, occurrence, occurrenceFrom: "message" }
    : notYoursText;
}

// A Birthday has no module of its own, so «Готово» closes its rows here for every Member.
async function closeForEveryone(
  dependencies: ReminderDependencies,
  { row, source, presser, occurrence }: Press,
) {
  await closeOccurrence(dependencies, {
    rows: await dependencies.dispatch.ofSource(row),
    occurrence,
    by: presser.member,
    sourceOf: () => source,
  });
}

async function snooze(
  dependencies: ReminderDependencies,
  { row, outcome }: { row: DispatchRow; outcome: Extract<PressOutcome, { status: "snoozed" }> },
) {
  await dependencies.dispatch.update(row.familyId, row.id, outcome.patch);

  if (outcome.edit !== undefined) {
    await editMessage(dependencies, outcome.edit);
  }
}

// The text the pressed button answers with, or nothing when it did what it says.
async function pressed(
  dependencies: ReminderDependencies,
  { press, action, tasks }: Pressing,
): Promise<string | undefined> {
  const { row, source, occurrence, occurrenceFrom } = press;
  const now = dependencies.clock.now();
  const reminder = await reminderOfRow(dependencies, { row, source, occurrence, now });
  const outcome = reminder.press({ action, occurrenceFrom });

  if (outcome.status === "refused") {
    return outcome.text;
  }

  if (outcome.status === "complete-task") {
    const target = { taskId: outcome.taskId, occurrence: outcome.occurrence };
    const { status } = await tasks.complete(press.presser, target);

    return status === "ok" ? undefined : notDoneText;
  }

  await (outcome.status === "close-for-everyone"
    ? closeForEveryone(dependencies, press)
    : snooze(dependencies, { row: press.row, outcome }));

  return undefined;
}

export async function handleReminderCallback(
  dependencies: ReminderDependencies,
  query: CallbackQuery,
  tasks: TaskCompletion,
): Promise<void> {
  const parsed = parseCallback(query.data);
  const press =
    parsed && (await botPressOf(dependencies, { ...parsed, telegramId: query.from.id }));
  const text =
    parsed === undefined || press === undefined
      ? notYoursText
      : await pressed(dependencies, { press, action: parsed.action, tasks });

  await ignoringBotErrors(
    dependencies.bot.call(
      "answerCallbackQuery",
      text === undefined ? { callback_query_id: query.id } : { callback_query_id: query.id, text },
    ),
  );
}

// «Готово» or «Отложить» on a Push: what the bot's buttons do, with the presser read from the
// token instead of Telegram (ADR 0016).
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

  return typeof press === "string" ? press : pressed(dependencies, { press, action, tasks });
}
