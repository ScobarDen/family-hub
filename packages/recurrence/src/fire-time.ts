import { Temporal } from "temporal-polyfill";

import { occurrenceMoment } from "./occurrence.ts";

type EventOffset = "at-start" | "15m" | "1h" | "1d" | "1w";

type EventStart = { date: string; time: string | null; timeZone: string | null };

const morningTime = "09:00";

const offsetBefore: Record<EventOffset, Temporal.DurationLike> = {
  "at-start": { minutes: 0 },
  "15m": { minutes: 15 },
  "1h": { hours: 1 },
  "1d": { days: 1 },
  "1w": { weeks: 1 },
};

type PlanLead = "on-day" | "1d" | "1w";

const planLeadDays: Record<PlanLead, number> = { "on-day": 0, "1d": 1, "1w": 7 };

const dueLeadDays = 7;
const overdueRepeatDays = 7;

// Floating dates — all-day Events, birthdays, Due Dates — nudge at 09:00 on the Recipient's clock.
export function morningOf(date: string, timeZone: string): number {
  return occurrenceMoment(date, { time: morningTime, timeZone });
}

// A timed Event's Reminder comes its offset before the start; an all-day one at 09:00 that day,
// the day before or the week before, in the Recipient's own zone.
export function eventReminderMoment(
  occurrence: string,
  {
    start,
    offset,
    recipientZone,
  }: { start: EventStart; offset: EventOffset; recipientZone: string },
): number {
  if (start.time === null || start.timeZone === null) {
    const day = Temporal.PlainDate.from(occurrence).subtract(offsetBefore[offset]);

    return morningOf(day.toString(), recipientZone);
  }

  return Temporal.PlainDate.from(occurrence)
    .toZonedDateTime({ timeZone: start.timeZone, plainTime: Temporal.PlainTime.from(start.time) })
    .subtract(offsetBefore[offset]).epochMilliseconds;
}

// The days a Due Date nudges on: a week ahead, on the day, then every week while it stays open.
export function dueStepFrom(dueDate: string, day: string): string {
  const due = Temporal.PlainDate.from(dueDate);
  const lead = due.subtract({ days: dueLeadDays });
  const from = Temporal.PlainDate.from(day);

  if (Temporal.PlainDate.compare(from, lead) <= 0) {
    return lead.toString();
  }

  if (Temporal.PlainDate.compare(from, due) <= 0) {
    return due.toString();
  }

  const weeksLate = Math.ceil(due.until(from).days / overdueRepeatDays);

  return due.add({ days: weeksLate * overdueRepeatDays }).toString();
}

// A Plan's deadline nudges at 09:00 on the Recipient's clock: on the day, a day or a week before.
export function planReminderMoment(
  dueDate: string,
  { lead, recipientZone }: { lead: PlanLead; recipientZone: string },
): number {
  const day = Temporal.PlainDate.from(dueDate).subtract({ days: planLeadDays[lead] });

  return morningOf(day.toString(), recipientZone);
}
