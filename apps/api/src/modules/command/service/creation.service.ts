import type { z } from "zod";

import {
  careEntryChange,
  eventChange,
  reminderChange,
  type CareEntryDraft,
  type CommandDraft,
  type DraftRefusal,
  type EventDraft,
  type ReminderDraft,
} from "@family-hub/contract";
import { occurrenceMoment, timeInZone } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";

import type { CommandDependencies } from "../command.types.ts";

// When and where the phrase was said: a draft confirmed hours later still means that day and zone.
export type Phrase = { saidAt: number; timeZone: string };

export type Creation =
  | { status: "created"; id: string }
  | { status: "refused"; refusal: DraftRefusal };

type Saved = { status: string; id: string | undefined };

const refusalsByStatus: Partial<Record<string, DraftRefusal>> = {
  "recipients-not-allowed": "RECIPIENTS_NOT_ALLOWED",
  "pet-not-found": "PET_NOT_FOUND",
  archived: "PET_ARCHIVED",
};

function reminderChangeOf(draft: ReminderDraft, { timeZone }: Phrase) {
  return reminderChange.safeParse({
    text: draft.text,
    start: { date: draft.date, time: draft.time, timeZone },
    recurrence: draft.recurrence,
    visibility: draft.visibility,
    recipientIds: draft.recipientIds,
  });
}

// An all-day Event keeps a floating date; a timed one is a moment in the phrase's zone.
function eventChangeOf(draft: EventDraft, { timeZone }: Phrase) {
  return eventChange.safeParse({
    title: draft.title,
    note: draft.note,
    start: {
      date: draft.date,
      time: draft.time,
      timeZone: draft.time === null ? null : timeZone,
    },
    end: draft.endDate === null ? null : { date: draft.endDate, time: draft.endTime },
    recurrence: draft.recurrence,
    visibility: draft.visibility,
    reminderOffsets: draft.reminderOffsets,
  });
}

// No date is the moment it was said; «вчера» alone keeps the time of day it was said at.
function occurredAtOf({ date, time }: CareEntryDraft, { saidAt, timeZone }: Phrase): number {
  return date === null
    ? saidAt
    : occurrenceMoment(date, { time: time ?? timeInZone(saidAt, timeZone), timeZone });
}

function careEntryChangeOf(draft: CareEntryDraft, phrase: Phrase) {
  return careEntryChange.safeParse({
    occurredAt: occurredAtOf(draft, phrase),
    note: draft.note,
    details: draft.details,
    photoIds: [],
  });
}

async function saved<Change>(
  change: z.ZodSafeParseResult<Change>,
  save: (valid: Change) => Promise<Saved>,
): Promise<Creation> {
  if (!change.success) {
    return { status: "refused", refusal: "INVALID_REQUEST" };
  }

  const { status, id } = await save(change.data);

  return status === "ok" && id !== undefined
    ? { status: "created", id }
    : { status: "refused", refusal: refusalsByStatus[status] ?? "INVALID_REQUEST" };
}

// «Создать» goes through the same use case as the Mini App form of the draft's kind.
export async function createRecord(
  { reminders, events, careEntries }: CommandDependencies,
  { membership, draft, phrase }: { membership: Membership; draft: CommandDraft; phrase: Phrase },
): Promise<Creation> {
  if (draft.kind === "care_entry") {
    const { petId } = draft;

    // The Care Entry use case also derives the Due Date's key, so the entry closes the one before.
    return petId === null
      ? { status: "refused", refusal: "INVALID_REQUEST" }
      : saved(careEntryChangeOf(draft, phrase), async (change) => {
          const result = await careEntries.create(membership, petId, change);

          return { status: result.status, id: result.entry?.id };
        });
  }

  if (draft.kind === "event") {
    return saved(eventChangeOf(draft, phrase), async (change) => {
      const result = await events.create(membership, change);

      return { status: result.status, id: result.event?.id };
    });
  }

  return saved(reminderChangeOf(draft, phrase), async (change) => {
    const result = await reminders.create(membership, change);

    return { status: result.status, id: result.reminder?.id };
  });
}
