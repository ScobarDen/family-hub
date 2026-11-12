import type { InlineKeyboardMarkup } from "@grammyjs/types";

import { encodeDeepLink, type PushMessage } from "@family-hub/contract";

import type { PressTarget, ReminderSource } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import {
  alreadyDoneText,
  doneText,
  latenessLimitMs,
  passedText,
  snoozedText,
} from "./reminder.lib.ts";

export type PushSending = { message: Omit<PushMessage, "pressToken">; press?: PressTarget };

export type Due =
  | { status: "late" }
  | { status: "silent" }
  | { status: "send"; bot: { text: string; buttons: InlineKeyboardMarkup }; push: PushSending };

export type RowPatch = Partial<
  Pick<
    DispatchRow,
    | "occurrence"
    | "nextFireAt"
    | "sentOccurrence"
    | "chatId"
    | "messageId"
    | "doneAt"
    | "doneBy"
    | "lockedUntil"
    | "updatedAt"
  >
>;

export type Delivered =
  | { status: "sent"; sent: { chatId: number; messageId: number } }
  | { status: "pushed" }
  | { status: "skipped" };

export type MessageEdit = { chatId: number; messageId: number; text: string };

export type PressOutcome =
  | { status: "refused"; text: string }
  | { status: "complete-task"; taskId: string; occurrence: string | null }
  | { status: "close-for-everyone" }
  | { status: "snoozed"; patch: RowPatch; edit?: MessageEdit };

export type Closing = { patch: RowPatch; edit?: MessageEdit };

type Press = { action: "done" | "snooze"; via: "bot" | "push" };

type Reading = {
  row: DispatchRow;
  source: ReminderSource;
  occurrence: string | null;
  timeZone: string;
  now: number;
};

function titleOf({ source, occurrence, timeZone }: Reading): string {
  return source.kind.title(occurrence ?? "", timeZone);
}

function pushOf(reading: Reading, body: string | undefined): PushSending {
  const { row, source, occurrence, timeZone, now } = reading;
  const { kind } = source;
  const text = kind.pushText(occurrence ?? "", { timeZone, now, body });

  return {
    message: {
      ...text,
      text: text.title,
      tag: row.id,
      ...(kind.deepLink === undefined ? {} : { startParam: encodeDeepLink(kind.deepLink) }),
    },
    ...(kind.closing.by === "none" ? {} : { press: { dispatchId: row.id, occurrence } }),
  };
}

function sendingOf(reading: Reading, body: string | undefined): Due {
  const { row, source, occurrence } = reading;
  const headline = `${source.kind.emoji} ${titleOf(reading)}`;

  return {
    status: "send",
    bot: {
      text:
        body === undefined
          ? headline
          : `${headline}

${body}`,
      buttons: source.kind.buttons(row.id, occurrence ?? ""),
    },
    push: pushOf(reading, body),
  };
}

// A Reminder more than 12 hours late moves on without a stale message; a Digest's body is read
// only when it is sent.
async function dueOf(reading: Reading): Promise<Due> {
  const { row, source, now } = reading;

  if (now - (row.nextFireAt ?? now) > latenessLimitMs) {
    return { status: "late" };
  }

  const content = await source.kind.content();

  if (content.status === "nothing-to-say") {
    return { status: "silent" };
  }

  return sendingOf(reading, content.status === "body" ? content.body : undefined);
}

function nextFireOf({
  source,
  occurrence,
  timeZone,
}: Reading): Pick<RowPatch, "occurrence" | "nextFireAt"> {
  const next = occurrence === null ? undefined : source.schedule.next(occurrence);

  return next === undefined
    ? { occurrence: null, nextFireAt: null }
    : { occurrence: next, nextFireAt: source.schedule.fireAt(next, timeZone) };
}

// A pushed Occurrence is remembered like a sent one, so «Готово» elsewhere marks it done and a
// later «Отложить» on the Push cannot bring it back; it has no bot message to edit.
function sentColumnsOf({ occurrence }: Reading, delivered: Delivered): RowPatch {
  if (delivered.status === "sent") {
    return { sentOccurrence: occurrence, ...delivered.sent, doneAt: null, doneBy: null };
  }

  return delivered.status === "pushed"
    ? { sentOccurrence: occurrence, chatId: null, messageId: null, doneAt: null, doneBy: null }
    : {};
}

// Sent or not, the row moves on to the next Occurrence; the message it sent stays answerable.
function advancedOf(reading: Reading, delivered: Delivered): RowPatch {
  return {
    ...nextFireOf(reading),
    lockedUntil: null,
    updatedAt: reading.now,
    ...sentColumnsOf(reading, delivered),
  };
}

function withEdit<Result>({ row }: Reading, result: Result, text: string): Result {
  return row.chatId === null || row.messageId === null
    ? result
    : { ...result, edit: { chatId: row.chatId, messageId: row.messageId, text } };
}

// The one rule for the bot and a Push: the Task series tells, or the mark «Готово» left on the
// row; it was done, skipped or is no longer one its source reminds of.
function isClosed({ row, source, occurrence }: Reading): boolean {
  const { closing } = source.kind;

  return occurrence !== null && closing.by === "task"
    ? closing.isClosed(occurrence)
    : row.sentOccurrence === occurrence && row.doneAt !== null;
}

// A Push left on screen after a later Occurrence was delivered may still be done, but snoozing
// it would push that later one aside; so would snoozing an Occurrence someone already did.
function refusalOf(reading: Reading, press: Press): string | undefined {
  const isPassed =
    press.via === "push" &&
    press.action === "snooze" &&
    reading.row.sentOccurrence !== reading.occurrence;

  if (isPassed) {
    return passedText;
  }

  return isClosed(reading) ? alreadyDoneText : undefined;
}

// «Отложить» is the presser's own: their row comes back for the same Occurrence later.
function snoozedOf(reading: Reading): PressOutcome {
  const { source, occurrence, timeZone, now } = reading;
  const until = now + source.kind.snoozeMs;
  const snoozed: PressOutcome = {
    status: "snoozed",
    patch: { occurrence, nextFireAt: until, updatedAt: now },
  };

  return withEdit(reading, snoozed, snoozedText({ text: titleOf(reading), until, timeZone }));
}

function pressOutcomeOf(reading: Reading, press: Press): PressOutcome {
  const refusal = refusalOf(reading, press);
  const { closing } = reading.source.kind;

  if (refusal !== undefined) {
    return { status: "refused", text: refusal };
  }

  if (press.action === "snooze" || closing.by === "none") {
    return snoozedOf(reading);
  }

  return closing.by === "task"
    ? { status: "complete-task", taskId: closing.taskId, occurrence: reading.occurrence }
    : { status: "close-for-everyone" };
}

// A closed Occurrence is closed for every Recipient: a message sent of it turns into
// «Сделал(а) …», once, and a row still waiting for it moves on.
function closingOf(reading: Reading, by: { id: string; name: string }): Closing | undefined {
  const { row, occurrence, now } = reading;
  const isUnmarked = row.sentOccurrence === occurrence && row.doneAt === null;
  const isWaiting = occurrence !== null && row.occurrence === occurrence;

  if (!isUnmarked && !isWaiting) {
    return undefined;
  }

  const closing: Closing = {
    patch: {
      ...(isUnmarked ? { doneAt: now, doneBy: by.id } : {}),
      ...(isWaiting ? nextFireOf(reading) : {}),
      updatedAt: now,
    },
  };

  return isUnmarked
    ? withEdit(reading, closing, doneText({ text: titleOf(reading), doneBy: by.name }))
    : closing;
}

export function recipientReminder(reading: Reading) {
  return {
    due: async () => dueOf(reading),
    advanced: (delivered: Delivered) => advancedOf(reading, delivered),
    press: (action: Press["action"], via: Press["via"]) => pressOutcomeOf(reading, { action, via }),
    closed: (by: { id: string; name: string }) => closingOf(reading, by),
  };
}

export type RecipientReminder = ReturnType<typeof recipientReminder>;
