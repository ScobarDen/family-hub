import { z } from "zod";

import { recurrence } from "./event.ts";
import { visibility } from "./plan.ts";
import { reminderTextMaxLength } from "./reminder.ts";

export const commandDraftLifetimeMs = 86_400_000;

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

export const commandDraft = z.discriminatedUnion("kind", [reminderDraft]);

export type CommandDraft = z.infer<typeof commandDraft>;

// What the model answers: a draft, or that the phrase is beyond it, or a refused kind of command.
export const commandAnswer = z.discriminatedUnion("outcome", [
  reminderDraft.omit({ kind: true }).extend({ outcome: z.literal("reminder") }),
  z.object({ outcome: z.literal("unsupported") }),
  z.object({ outcome: z.literal("unrecognized") }),
]);

export type CommandAnswer = z.infer<typeof commandAnswer>;
