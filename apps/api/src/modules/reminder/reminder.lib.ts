import type { InlineKeyboardMarkup } from "@grammyjs/types";

import type { Reminder } from "@family-hub/contract";
import {
  dateInZone,
  dayAfter,
  firstOccurrenceFrom,
  occurrenceMoment,
  timeInZone,
} from "@family-hub/recurrence";

import type { ReminderRow, ReminderWithRecipients } from "./repo/reminder.repo.ts";

export const callbackPrefix = "rd";
export const snoozeMs = 3_600_000;
// A Reminder more than 12 hours late moves on to its next Occurrence without a stale message.
export const latenessLimitMs = 43_200_000;

export type ReminderAction = "done" | "snooze";

export type Fire = { occurrence: string; fireAt: number };

const callbackPattern = new RegExp(`^${callbackPrefix}:(done|snooze):(.+)$`);

export function toReminder(
  { reminder, recipients }: ReminderWithRecipients,
  memberId: string,
): Reminder {
  return {
    id: reminder.id,
    text: reminder.text,
    start: { date: reminder.startDate, time: reminder.startTime, timeZone: reminder.timeZone },
    recurrence:
      reminder.frequency === null ? null : { frequency: reminder.frequency, until: reminder.until },
    visibility: reminder.visibility,
    isOwn: reminder.ownerMemberId === memberId,
    isForEveryone: reminder.isForEveryone,
    recipients,
  };
}

function fireOf(row: ReminderRow, occurrence: string | undefined): Fire | undefined {
  return occurrence === undefined
    ? undefined
    : {
        occurrence,
        fireAt: occurrenceMoment(occurrence, { time: row.startTime, timeZone: row.timeZone }),
      };
}

function seriesOf(row: ReminderRow) {
  return row.frequency === null ? null : { frequency: row.frequency, until: row.until };
}

// The first Occurrence still ahead of now, counted on the days of the creator's zone.
export function upcomingFire(row: ReminderRow, now: number): Fire | undefined {
  const today = dateInZone(now, row.timeZone);
  const first = fireOf(row, firstOccurrenceFrom(row.startDate, seriesOf(row), today));

  return first === undefined || first.fireAt >= now ? first : fireAfter(row, first.occurrence);
}

export function fireAfter(row: ReminderRow, occurrence: string): Fire | undefined {
  return fireOf(row, firstOccurrenceFrom(row.startDate, seriesOf(row), dayAfter(occurrence)));
}

export function parseCallback(data: string | undefined) {
  const match = callbackPattern.exec(data ?? "");

  return match?.[1] === undefined || match[2] === undefined
    ? undefined
    : {
        action: match[1] === "done" ? ("done" as const) : ("snooze" as const),
        dispatchId: match[2],
      };
}

export function reminderButtons(dispatchId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "✅ Готово", callback_data: `${callbackPrefix}:done:${dispatchId}` },
        { text: "⏰ Отложить на час", callback_data: `${callbackPrefix}:snooze:${dispatchId}` },
      ],
    ],
  };
}

export function reminderText(text: string): string {
  return `🔔 ${text}`;
}

export function doneText({ text, doneBy }: { text: string; doneBy: string }): string {
  return `✅ Сделал(а) ${doneBy}: ${text}`;
}

export function snoozedText({
  text,
  until,
  timeZone,
}: {
  text: string;
  until: number;
  timeZone: string;
}) {
  return `⏰ Отложено до ${timeInZone(until, timeZone)}: ${text}`;
}

export const notYoursText = "Это не ваше напоминание";
