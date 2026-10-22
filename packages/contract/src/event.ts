import { z } from "zod";

import { isTimeZone } from "./member.ts";
import { visibility } from "./plan.ts";
import { date, time } from "./primitive.ts";
import { optionalText } from "./text.ts";

export const eventTitleMaxLength = 200;
export const eventNoteMaxLength = 2000;

// An all-day Event has a date only; a timed one also has the wall-clock time and the zone it was
// set in, which its Occurrences keep.
const eventStart = z
  .object({ date, time: time.nullable(), timeZone: z.string().refine(isTimeZone).nullable() })
  .refine(({ time: startTime, timeZone }) => (startTime === null) === (timeZone === null), {
    message: "A timed start needs its zone, an all-day one has none",
  });

const eventEnd = z.object({ date, time: time.nullable() });

export const frequency = z.enum(["weekly", "monthly", "yearly"]);

export const recurrence = z.object({ frequency, until: date.nullable() });

export const eventReminderOffset = z.enum(["at-start", "15m", "1h", "1d", "1w"]);

export type EventReminderOffset = z.infer<typeof eventReminderOffset>;

export const eventReminderMaxCount = 3;

const reminderOffsets = z
  .array(eventReminderOffset)
  .max(eventReminderMaxCount)
  .refine((offsets) => new Set(offsets).size === offsets.length, "Offsets repeat");

export type Recurrence = z.infer<typeof recurrence>;

type EventSpan = {
  start: { date: string; time: string | null };
  end: { date: string; time: string | null } | null;
};

function isEndAfterStart({ start, end }: EventSpan): boolean {
  if (end === null) {
    return true;
  }

  if (end.date !== start.date) {
    return end.date > start.date;
  }

  return start.time === null || end.time === null || end.time >= start.time;
}

export const eventChange = z
  .object({
    title: z.string().trim().min(1).max(eventTitleMaxLength),
    note: optionalText(eventNoteMaxLength),
    start: eventStart,
    end: eventEnd.nullable(),
    recurrence: recurrence.nullable(),
    visibility,
    reminderOffsets: reminderOffsets.default([]),
  })
  .refine(isEndAfterStart, {
    message: "An Event ends after it starts",
    path: ["end"],
  });

export type EventChange = z.infer<typeof eventChange>;

export const calendarEvent = z.object({
  id: z.string(),
  title: z.string(),
  note: z.string().nullable(),
  start: eventStart,
  end: eventEnd.nullable(),
  recurrence: recurrence.nullable(),
  visibility,
  reminderOffsets: z.array(eventReminderOffset),
  isOwn: z.boolean(),
  skippedDates: z.array(date),
});

export type CalendarEvent = z.infer<typeof calendarEvent>;

export const calendarEventList = z.array(calendarEvent);

export type CalendarEventList = z.infer<typeof calendarEventList>;

export const occurrenceSkip = z.object({ date });
