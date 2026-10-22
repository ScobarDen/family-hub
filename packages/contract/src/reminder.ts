import { z } from "zod";

import { recurrence } from "./event.ts";
import { isTimeZone } from "./member.ts";
import { visibility } from "./plan.ts";
import { date, named, time } from "./primitive.ts";

export const reminderTextMaxLength = 500;

// A standalone Reminder fires at one moment for all its Recipients: its wall-clock time in the
// zone it was set in.
const reminderStart = z.object({ date, time, timeZone: z.string().refine(isTimeZone) });

export const reminderChange = z.object({
  text: z.string().trim().min(1).max(reminderTextMaxLength),
  start: reminderStart,
  recurrence: recurrence.nullable(),
  visibility,
  // null sends a Shared Reminder to every Member; a Private one only ever goes to its owner.
  recipientIds: z.array(z.string()).min(1).nullable(),
});

export type ReminderChange = z.infer<typeof reminderChange>;

export const reminder = z.object({
  id: z.string(),
  text: z.string(),
  start: reminderStart,
  recurrence: recurrence.nullable(),
  visibility,
  isOwn: z.boolean(),
  isForEveryone: z.boolean(),
  recipients: z.array(named),
});

export type Reminder = z.infer<typeof reminder>;

export const reminderList = z.array(reminder);

export type ReminderList = z.infer<typeof reminderList>;
