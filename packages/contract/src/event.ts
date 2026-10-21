import { z } from "zod";

import { isTimeZone } from "./member.ts";
import { visibility } from "./plan.ts";
import { optionalText } from "./text.ts";

export const eventTitleMaxLength = 200;
export const eventNoteMaxLength = 2000;

const date = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

// An all-day Event has a date only; a timed one also has the wall-clock time and the zone it was
// set in, which its Occurrences keep.
export const eventStart = z
  .object({ date, time: time.nullable(), timeZone: z.string().refine(isTimeZone).nullable() })
  .refine(({ time: startTime, timeZone }) => (startTime === null) === (timeZone === null), {
    message: "A timed start needs its zone, an all-day one has none",
  });

export const eventEnd = z.object({ date, time: time.nullable() });

export const frequency = z.enum(["weekly", "monthly", "yearly"]);

export const recurrence = z.object({ frequency, until: date.nullable() });

export type Recurrence = z.infer<typeof recurrence>;

export const eventChange = z
  .object({
    title: z.string().trim().min(1).max(eventTitleMaxLength),
    note: optionalText(eventNoteMaxLength),
    start: eventStart,
    end: eventEnd.nullable(),
    recurrence: recurrence.nullable(),
    visibility,
  })
  .refine(({ start, end }) => end === null || end.date >= start.date, {
    message: "An Event ends after it starts",
    path: ["end"],
  });

export type EventChange = z.infer<typeof eventChange>;

export const calendarEvent = z.object({
  id: z.string(),
  title: z.string(),
  note: z.string().nullable(),
  start: z.object({ date, time: time.nullable(), timeZone: z.string().nullable() }),
  end: eventEnd.nullable(),
  recurrence: recurrence.nullable(),
  visibility,
  isOwn: z.boolean(),
  skippedDates: z.array(date),
});

export type CalendarEvent = z.infer<typeof calendarEvent>;

export const calendarEventList = z.array(calendarEvent);

export type CalendarEventList = z.infer<typeof calendarEventList>;

export const occurrenceSkip = z.object({ date });

export type OccurrenceSkip = z.infer<typeof occurrenceSkip>;

export const eventDeleted = z.object({ status: z.literal("deleted") });

export type EventDeleted = z.infer<typeof eventDeleted>;
