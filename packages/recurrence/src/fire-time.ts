import { Temporal } from "temporal-polyfill";

import type { ReminderOffset, TaskWhen } from "@family-hub/contract";

import { occurrenceMoment } from "./occurrence.ts";

const morningTime = "09:00";

const offsetBefore: Record<ReminderOffset, Temporal.DurationLike> = {
  "at-start": { minutes: 0 },
  "15m": { minutes: 15 },
  "1h": { hours: 1 },
  "1d": { days: 1 },
  "1w": { weeks: 1 },
};

// Floating dates — Tasks without a time, birthdays — nudge at 09:00 on the Recipient's clock.
export function morningOf(date: string, timeZone: string): number {
  return occurrenceMoment(date, { time: morningTime, timeZone });
}

// A timed Task's Reminder comes its offset before the start; one without a time at 09:00 that day,
// the day before or the week before, in the Recipient's own zone.
export function taskReminderMoment(
  occurrence: string,
  {
    when,
    offset,
    recipientZone,
  }: {
    when: Pick<TaskWhen, "time" | "timeZone">;
    offset: ReminderOffset;
    recipientZone: string;
  },
): number {
  if (when.time === null || when.timeZone === null) {
    const day = Temporal.PlainDate.from(occurrence).subtract(offsetBefore[offset]);

    return morningOf(day.toString(), recipientZone);
  }

  return Temporal.PlainDate.from(occurrence)
    .toZonedDateTime({ timeZone: when.timeZone, plainTime: Temporal.PlainTime.from(when.time) })
    .subtract(offsetBefore[offset]).epochMilliseconds;
}
