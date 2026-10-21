import { z } from "zod";

import {
  eventNoteMaxLength,
  eventReminderMaxCount,
  eventReminderOffset,
  eventTitleMaxLength,
  recurrence,
} from "./event.ts";
import { visibility } from "./plan.ts";
import { reminderTextMaxLength } from "./reminder.ts";

export const commandDraftLifetimeMs = 86_400_000;

export const voiceMaxSeconds = 30;

// Thirty seconds of speech is well under a megabyte in any format a WebView records.
export const voiceMaxBytes = 2_097_152;

const ambiguousCandidates = 2;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u);

// What a Reminder needs and the phrase may lack; such a draft is shown without «Создать».
export const reminderDraftField = z.enum(["text", "date", "time"]);

export type ReminderDraftField = z.infer<typeof reminderDraftField>;

// A name that matched several Members comes back with all of them for the Member to pick from.
export const draftAmbiguity = z.object({
  field: z.literal("recipients"),
  mention: z.string(),
  candidateIds: z.array(z.string()).min(ambiguousCandidates),
});

export type DraftAmbiguity = z.infer<typeof draftAmbiguity>;

// The fields of the standalone Reminder form; the moment is on the speaker's own clock.
export const reminderDraft = z.object({
  kind: z.literal("reminder"),
  text: z.string().trim().min(1).max(reminderTextMaxLength).nullable(),
  date: z.iso.date().nullable(),
  time: time.nullable(),
  recurrence: recurrence.nullable(),
  visibility,
  recipientIds: z.array(z.string()).nullable(),
  missing: z.array(reminderDraftField),
  ambiguities: z.array(draftAmbiguity),
});

export type ReminderDraft = z.infer<typeof reminderDraft>;

export const eventDraftField = z.enum(["title", "date"]);

export type EventDraftField = z.infer<typeof eventDraftField>;

// The fields of the Event form: no time means all day, on a floating date; a time is a moment
// in the speaker's zone. Its Reminders are offsets before the start, as in the form.
export const eventDraft = z.object({
  kind: z.literal("event"),
  title: z.string().trim().min(1).max(eventTitleMaxLength).nullable(),
  note: z.string().trim().min(1).max(eventNoteMaxLength).nullable(),
  date: z.iso.date().nullable(),
  time: time.nullable(),
  endDate: z.iso.date().nullable(),
  endTime: time.nullable(),
  recurrence: recurrence.nullable(),
  visibility,
  reminderOffsets: z.array(eventReminderOffset).max(eventReminderMaxCount),
  missing: z.array(eventDraftField),
  ambiguities: z.array(draftAmbiguity),
});

export type EventDraft = z.infer<typeof eventDraft>;

export const commandKind = z.enum(["reminder", "event"]);

export type CommandKind = z.infer<typeof commandKind>;

export const commandDraft = z.discriminatedUnion("kind", [reminderDraft, eventDraft]);

export type CommandDraft = z.infer<typeof commandDraft>;

// What the model answers: a draft, or that the phrase is beyond it, or a refused kind of command.
export const commandAnswer = z.discriminatedUnion("outcome", [
  reminderDraft.omit({ kind: true }).extend({ outcome: z.literal("reminder") }),
  eventDraft.omit({ kind: true }).extend({ outcome: z.literal("event") }),
  z.object({ outcome: z.literal("unsupported") }),
  z.object({ outcome: z.literal("unrecognized") }),
]);

export type CommandAnswer = z.infer<typeof commandAnswer>;

// Why a command became no draft; the bot and the Mini App say the same words for each.
export const commandFailure = z.enum([
  "unrecognized",
  "unsupported",
  "quota",
  "unheard",
  "too_long",
]);

export type CommandFailure = z.infer<typeof commandFailure>;

// What the Mini App gets for a recording or a draft it opens; heard is the transcript, if any.
export const commandOutcome = z.union([
  z.object({
    status: z.literal("draft"),
    draftId: z.string(),
    heard: z.string().nullable(),
    draft: commandDraft,
  }),
  z.object({ status: commandFailure, heard: z.string().nullable(), message: z.string() }),
]);

export type CommandOutcome = z.infer<typeof commandOutcome>;

export const draftPick = z.object({ index: z.int().nonnegative() });

export type DraftPick = z.infer<typeof draftPick>;

export const draftCreated = z.object({ kind: commandKind, id: z.string() });

export type DraftCreated = z.infer<typeof draftCreated>;

// Where the microphone sends a Member whose WebView cannot record: the bot chat.
export const botChat = z.object({ url: z.url() });

export type BotChat = z.infer<typeof botChat>;

export const draftSettled = z.object({ status: z.enum(["dismissed", "created"]) });

export type DraftSettled = z.infer<typeof draftSettled>;
