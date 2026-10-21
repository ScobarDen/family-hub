import {
  careEntryChange,
  eventChange,
  reminderChange,
  type CareEntryDraft,
  type CommandDraft,
  type EventDraft,
  type ReminderDraft,
} from "@family-hub/contract";
import { occurrenceMoment, timeInZone } from "@family-hub/recurrence";

import type { Membership } from "@/common/auth";

import type { CommandDependencies } from "../command.types.ts";

const fallbackTimeZone = "UTC";

type Creating<Draft> = { membership: Membership; draft: Draft; timeZone: string };

async function reminderOf(
  { reminders }: CommandDependencies,
  { membership, draft, timeZone }: Creating<ReminderDraft>,
): Promise<string | undefined> {
  const change = reminderChange.safeParse({
    text: draft.text,
    start: { date: draft.date, time: draft.time, timeZone },
    recurrence: draft.recurrence,
    visibility: draft.visibility,
    recipientIds: draft.recipientIds,
  });
  const result = change.success ? await reminders.create(membership, change.data) : undefined;

  return result?.status === "ok" ? result.reminder?.id : undefined;
}

// An all-day Event keeps a floating date; a timed one is a moment in the speaker's zone.
async function eventOf(
  { events }: CommandDependencies,
  { membership, draft, timeZone }: Creating<EventDraft>,
): Promise<string | undefined> {
  const change = eventChange.safeParse({
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
  const result = change.success ? await events.create(membership, change.data) : undefined;

  return result?.status === "ok" ? result.event?.id : undefined;
}

// No date is now; «вчера» alone keeps the time of day it was said at.
function occurredAtOf(
  { date, time }: CareEntryDraft,
  { now, timeZone }: { now: number; timeZone: string },
): number {
  return date === null
    ? now
    : occurrenceMoment(date, { time: time ?? timeInZone(now, timeZone), timeZone });
}

// The Care Entry use case also derives the Due Date's key, so the entry closes the one before.
async function careEntryOf(
  { careEntries, clock }: CommandDependencies,
  { membership, draft, timeZone }: Creating<CareEntryDraft>,
): Promise<string | undefined> {
  const change = careEntryChange.safeParse({
    occurredAt: occurredAtOf(draft, { now: clock.now(), timeZone }),
    note: draft.note,
    details: draft.details,
    photoIds: [],
  });
  const result =
    change.success && draft.petId !== null
      ? await careEntries.create(membership, draft.petId, change.data)
      : undefined;

  return result?.status === "ok" ? result.entry?.id : undefined;
}

// «Создать» goes through the same use case as the Mini App form of the draft's kind.
export async function createRecord(
  dependencies: CommandDependencies,
  { membership, draft }: { membership: Membership; draft: CommandDraft },
): Promise<string | undefined> {
  const timeZone = (await dependencies.drafts.timeZoneOf(membership.member.id)) ?? fallbackTimeZone;

  if (draft.kind === "care_entry") {
    return careEntryOf(dependencies, { membership, draft, timeZone });
  }

  return draft.kind === "event"
    ? eventOf(dependencies, { membership, draft, timeZone })
    : reminderOf(dependencies, { membership, draft, timeZone });
}
