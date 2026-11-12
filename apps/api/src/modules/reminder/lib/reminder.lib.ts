import type { InlineKeyboardMarkup } from "@grammyjs/types";

import { daysAfter, timeInZone } from "@family-hub/recurrence";

export const callbackPrefix = "rd";
export const snoozeMs = 3_600_000;
export const daySnoozeMs = 86_400_000;
// A Reminder more than 12 hours late moves on to its next Occurrence without a stale message.
export const latenessLimitMs = 43_200_000;

const callbackPattern = new RegExp(`^${callbackPrefix}:(done|snooze):(.+)$`);

const sourceIdSeparator = ":";

// A holder with several sources, a Task's offsets, tells them apart by a part after its own id.
export function sourceIdOf(holderId: string, part?: string): string {
  return part === undefined ? holderId : `${holderId}${sourceIdSeparator}${part}`;
}

export function holderIdOf(sourceId: string): string {
  return sourceId.split(sourceIdSeparator)[0] ?? sourceId;
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

// One set for every Reminder; a Task adds «Открыть», a Pet-linked one also «Записать», both as
// url buttons because web_app buttons work only in private chats.
export function reminderButtons(
  dispatchId: string,
  { recordUrl, openUrl }: { recordUrl?: string; openUrl?: string } = {},
): InlineKeyboardMarkup {
  const links = [
    ...(recordUrl === undefined ? [] : [{ text: "📝 Записать", url: recordUrl }]),
    ...(openUrl === undefined ? [] : [{ text: "Открыть", url: openUrl }]),
  ];

  return {
    inline_keyboard: [
      [
        {
          text: "✅ Готово",
          callback_data: `${callbackPrefix}:done:${dispatchId}`,
          style: "success",
        },
        { text: "⏰ Отложить", callback_data: `${callbackPrefix}:snooze:${dispatchId}` },
      ],
      ...(links.length === 0 ? [] : [links]),
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

export const alreadyDoneText = "Уже сделано";

export const passedText = "Это напоминание уже прошло";

export function openAppButton({ text, url }: { text: string; url: string }): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text, url }]] };
}

function dayMonth(timeZone: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone });
}

// A floating date is the same day everywhere, so it is shown as that day in UTC.
export function formatFloatingDate(date: string): string {
  return dayMonth("UTC").format(new Date(`${date}T12:00:00Z`));
}

export function dayLabelOf(date: string, today: string): string {
  if (date === today) {
    return "Сегодня";
  }

  return date === daysAfter(today, 1) ? "Завтра" : formatFloatingDate(date);
}

export function formatMomentIn(moment: number, timeZone: string): string {
  return `${dayMonth(timeZone).format(moment)}, ${timeInZone(moment, timeZone)}`;
}
