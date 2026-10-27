import { z } from "zod";

import { isTimeZone, profilePicture } from "./member.ts";
import { photo } from "./photo.ts";
import { date, time } from "./primitive.ts";
import { optionalText } from "./text.ts";

export const visibility = z.enum(["shared", "private"]);

export type Visibility = z.infer<typeof visibility>;

export const frequency = z.enum(["weekly", "monthly", "yearly"]);

export const recurrence = z.object({ frequency, until: date.nullable() });

export type Recurrence = z.infer<typeof recurrence>;

export const taskTitleMaxLength = 200;
export const taskNoteMaxLength = 2000;

export const reminderOffset = z.enum(["at-start", "15m", "1h", "1d", "1w"]);

export type ReminderOffset = z.infer<typeof reminderOffset>;

export const reminderMaxCount = 3;

// «15 minutes before» a whole day means nothing, so a Task without a time offers only these.
export const dateOnlyOffsets: ReminderOffset[] = ["at-start", "1d", "1w"];

// A recurring Task is looked back on this many days for Overdue Occurrences, so a forgotten weekly
// chore does not pile up forever; a single dated Task stays Overdue until it is done.
export const overdueLookbackDays = 30;

// A Task with a time keeps the wall-clock time and the zone it was set in, which its Occurrences
// keep; one without a time sits on a floating date.
export const taskWhen = z
  .object({
    date,
    time: time.nullable(),
    timeZone: z.string().refine(isTimeZone).nullable(),
    endDate: date.nullable(),
    endTime: time.nullable(),
  })
  .refine(({ time: startTime, timeZone }) => (startTime === null) === (timeZone === null), {
    message: "A timed Task needs its zone, a date-only one has none",
  })
  .refine(isEndAfterStart, { message: "A Task ends after it starts", path: ["endDate"] });

export type TaskWhen = z.infer<typeof taskWhen>;

function isEndAfterStart(when: {
  date: string;
  time: string | null;
  endDate: string | null;
  endTime: string | null;
}): boolean {
  const endDate = when.endDate ?? (when.endTime === null ? null : when.date);

  if (endDate === null) {
    return true;
  }

  if (endDate !== when.date) {
    return endDate > when.date;
  }

  return when.time === null || when.endTime === null || when.endTime >= when.time;
}

// «default» reminds the Assignees, or the author of a Task without them.
export const taskRecipients = z.union([
  z.literal("default"),
  z.literal("everyone"),
  z.array(z.string()).min(1),
]);

export type TaskRecipients = z.infer<typeof taskRecipients>;

const offsets = z
  .array(reminderOffset)
  .max(reminderMaxCount)
  .refine((list) => new Set(list).size === list.length, "Offsets repeat");

const title = z.string().trim().min(1).max(taskTitleMaxLength);

const assigneeIds = z.array(z.string()).default([]);

type Schedule = {
  when: TaskWhen | null;
  recurrence: Recurrence | null;
  reminderOffsets: ReminderOffset[];
};

// Nothing can fire or repeat without a date, and minutes before a whole day mean nothing.
function isScheduleValid({ when, recurrence: rule, reminderOffsets }: Schedule): boolean {
  if (when === null) {
    return rule === null && reminderOffsets.length === 0;
  }

  return when.time !== null || reminderOffsets.every((offset) => dateOnlyOffsets.includes(offset));
}

export const taskChange = z
  .object({
    title,
    note: optionalText(taskNoteMaxLength).default(null),
    when: taskWhen.nullable().default(null),
    recurrence: recurrence.nullable().default(null),
    assigneeIds,
    recipients: taskRecipients.default("default"),
    reminderOffsets: offsets.default([]),
    visibility: visibility.default("shared"),
    petId: z.string().nullable().default(null),
    albumId: z.string().nullable().default(null),
  })
  .refine(isScheduleValid, {
    message: "Recurrence and Reminders need a date; minutes and hours before need a time",
    path: ["reminderOffsets"],
  });

export type TaskChange = z.input<typeof taskChange>;

export type ParsedTaskChange = z.output<typeof taskChange>;

export const subtaskChange = z.object({ title, date: date.nullable().default(null), assigneeIds });

export type SubtaskChange = z.output<typeof subtaskChange>;

// The date of the Occurrence a completion or a skip is about; a Task without a date has one
// Occurrence, named null.
export const occurrenceTarget = z.object({ occurrence: date.nullable() });

export type OccurrenceTarget = z.infer<typeof occurrenceTarget>;

export const skipTarget = z.object({ date });

export const person = z.object({ id: z.string(), name: z.string(), profilePicture });

export type Person = z.infer<typeof person>;

export const completion = z.object({ at: z.number(), by: z.string().nullable() });

export type Completion = z.infer<typeof completion>;

export const occurrenceCompletion = completion.extend({ occurrence: date.nullable() });

export type OccurrenceCompletion = z.infer<typeof occurrenceCompletion>;

export const subtask = z.object({
  id: z.string(),
  title: z.string(),
  date: date.nullable(),
  assignees: z.array(person),
  completed: completion.nullable(),
});

export type Subtask = z.infer<typeof subtask>;

export const taskAlbumPreview = 10;

// A trip's Task shows a strip of its Album and opens the Album itself.
const taskAlbum = z.object({
  id: z.string(),
  title: z.string(),
  photos: z.array(photo),
  photoCount: z.number(),
});

export type TaskAlbum = z.infer<typeof taskAlbum>;

const taskPet = z.object({ id: z.string(), name: z.string(), picture: z.string().nullable() });

export const task = z.object({
  id: z.string(),
  title: z.string(),
  note: z.string().nullable(),
  when: taskWhen.nullable(),
  recurrence: recurrence.nullable(),
  skippedDates: z.array(date),
  assignees: z.array(person),
  recipients: z.union([z.literal("default"), z.literal("everyone"), z.array(person)]),
  reminderOffsets: z.array(reminderOffset),
  visibility,
  isOwn: z.boolean(),
  pet: taskPet.nullable(),
  album: taskAlbum.nullable(),
  completions: z.array(occurrenceCompletion),
  subtasks: z.array(subtask),
});

export type Task = z.infer<typeof task>;

export const taskList = z.array(task);

export type TaskList = z.infer<typeof taskList>;
