import type { InlineKeyboardMarkup } from "@grammyjs/types";

import type { Reminder } from "@family-hub/contract";
import { timeInZone } from "@family-hub/recurrence";

import type { ReminderWithRecipients } from "./repo/reminder.repo.ts";

export const callbackPrefix = "rd";
export const snoozeMs = 3_600_000;
export const daySnoozeMs = 86_400_000;
// A Reminder more than 12 hours late moves on to its next Occurrence without a stale message.
export const latenessLimitMs = 43_200_000;

const callbackPattern = new RegExp(`^${callbackPrefix}:(done|snooze):(.+)$`);

const sourceIdSeparator = ":";

// A holder with several sources, an Event's offsets or a Pet's Due Dates, tells them apart by a part
// after its own id.
export function sourceIdOf(holderId: string, part?: string): string {
  return part === undefined ? holderId : `${holderId}${sourceIdSeparator}${part}`;
}

export function holderIdOf(sourceId: string): string {
  return sourceId.split(sourceIdSeparator)[0] ?? sourceId;
}

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

export const notDoneText = "Не получилось отметить, откройте приложение";

export function planButtons(dispatchId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "✅ Выполнено", callback_data: `${callbackPrefix}:done:${dispatchId}` },
        { text: "⏰ Отложить на день", callback_data: `${callbackPrefix}:snooze:${dispatchId}` },
      ],
    ],
  };
}

export function openAppButton({ text, url }: { text: string; url: string }): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text, url }]] };
}

export function dueButtons({ dispatchId, recordUrl }: { dispatchId: string; recordUrl: string }) {
  return {
    inline_keyboard: [
      [
        { text: "📝 Записать", url: recordUrl },
        { text: "⏰ Отложить на день", callback_data: `${callbackPrefix}:snooze:${dispatchId}` },
      ],
    ],
  };
}

function dayMonth(timeZone: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone });
}

// A floating date is the same day everywhere, so it is shown as that day in UTC.
export function formatFloatingDate(date: string): string {
  return dayMonth("UTC").format(new Date(`${date}T12:00:00Z`));
}

export function formatMomentIn(moment: number, timeZone: string): string {
  return `${dayMonth(timeZone).format(moment)}, ${timeInZone(moment, timeZone)}`;
}
