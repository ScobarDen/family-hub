import { z } from "zod";

import { careDetails, careNoteMaxLength } from "./care-entry.ts";
import { errorCode } from "./error.ts";
import {
  eventNoteMaxLength,
  eventReminderMaxCount,
  eventReminderOffset,
  eventTitleMaxLength,
  recurrence,
} from "./event.ts";
import { visibility } from "./plan.ts";
import { time } from "./primitive.ts";
import { reminderTextMaxLength } from "./reminder.ts";

export const commandDraftLifetimeMs = 86_400_000;

export const voiceMaxSeconds = 30;

// Thirty seconds of speech is well under a megabyte in any format a WebView records.
export const voiceMaxBytes = 2_097_152;

const ambiguousCandidates = 2;

// What a Reminder needs and the phrase may lack; such a draft is shown without «Создать».
export const reminderDraftField = z.enum(["text", "date", "time"]);

export type ReminderDraftField = z.infer<typeof reminderDraftField>;

// A name that matched several Members or Pets comes back with all of them to pick from.
const draftAmbiguity = z.object({
  field: z.enum(["recipients", "pet"]),
  mention: z.string(),
  candidateIds: z.array(z.string()).min(ambiguousCandidates),
});

export type DraftAmbiguity = z.infer<typeof draftAmbiguity>;

// The fields of the standalone Reminder form; the moment is in the zone the phrase was said in.
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

export const careEntryDraftField = z.enum(["pet", "details"]);

export type CareEntryDraftField = z.infer<typeof careEntryDraftField>;

// The fields of the Care Entry form. No date means now; a date alone («вчера») keeps the time of
// day it was said at. Photos are added in the form only.
const careEntryDraft = z.object({
  kind: z.literal("care_entry"),
  petId: z.string().nullable(),
  date: z.iso.date().nullable(),
  time: time.nullable(),
  note: z.string().trim().min(1).max(careNoteMaxLength).nullable(),
  details: careDetails.nullable(),
  missing: z.array(careEntryDraftField),
  ambiguities: z.array(draftAmbiguity),
});

export type CareEntryDraft = z.infer<typeof careEntryDraft>;

const commandKind = z.enum(["reminder", "event", "care_entry"]);

export type CommandKind = z.infer<typeof commandKind>;

const commandDraft = z.discriminatedUnion("kind", [reminderDraft, eventDraft, careEntryDraft]);

export type CommandDraft = z.infer<typeof commandDraft>;

// What the model answers: a draft, or that the phrase is beyond it, or a refused kind of command.
// Workers AI decodes properties in schema order, so outcome goes first: when it came last, the
// model starting with «outcome» could only land on unsupported or unrecognized.
export const commandAnswer = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("reminder"), ...reminderDraft.omit({ kind: true }).shape }),
  z.object({ outcome: z.literal("event"), ...eventDraft.omit({ kind: true }).shape }),
  z.object({ outcome: z.literal("care_entry"), ...careEntryDraft.omit({ kind: true }).shape }),
  z.object({ outcome: z.literal("unsupported") }),
  z.object({ outcome: z.literal("unrecognized") }),
]);

export type CommandAnswer = z.infer<typeof commandAnswer>;

// Why a command became no draft; the bot and the Mini App say the same words for each.
const commandFailure = z.enum(["unrecognized", "unsupported", "quota", "unheard", "too_long"]);

export type CommandFailure = z.infer<typeof commandFailure>;

// When and in which zone the phrase was said: the draft's dates and times are read there.
const commandPhrase = z.object({ saidAt: z.int(), timeZone: z.string() });

export type CommandPhrase = z.infer<typeof commandPhrase>;

// What the Mini App gets for a recording or a draft it opens; heard is the transcript, if any.
export const commandOutcome = z.union([
  z.object({
    status: z.literal("draft"),
    draftId: z.string(),
    heard: z.string().nullable(),
    draft: commandDraft,
    phrase: commandPhrase,
  }),
  z.object({ status: commandFailure, heard: z.string().nullable(), message: z.string() }),
]);

export type CommandOutcome = z.infer<typeof commandOutcome>;

export const draftPick = z.object({ index: z.int().nonnegative() });

export const draftCreated = z.object({ kind: commandKind, id: z.string() });

export type DraftCreated = z.infer<typeof draftCreated>;

// Why the use case refused «Создать»: the code the Mini App gets, which the bot words the same way.
export const draftRefusal = errorCode.extract([
  "INVALID_REQUEST",
  "RECIPIENTS_NOT_ALLOWED",
  "PET_NOT_FOUND",
  "PET_ARCHIVED",
]);

export type DraftRefusal = z.infer<typeof draftRefusal>;

// Where the microphone sends a Member whose WebView cannot record: the bot chat.
export const botChat = z.object({ url: z.url() });

export type BotChat = z.infer<typeof botChat>;

export const draftSettled = z.object({ status: z.enum(["dismissed", "created"]) });

export type DraftSettled = z.infer<typeof draftSettled>;
