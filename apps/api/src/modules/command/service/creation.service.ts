import {
  eventChange,
  reminderChange,
  type CommandDraft,
  type EventDraft,
  type ReminderDraft,
} from "@family-hub/contract";

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

// «Создать» goes through the same use case as the Mini App form of the draft's kind.
export async function createRecord(
  dependencies: CommandDependencies,
  { membership, draft }: { membership: Membership; draft: CommandDraft },
): Promise<string | undefined> {
  const timeZone = (await dependencies.drafts.timeZoneOf(membership.member.id)) ?? fallbackTimeZone;

  return draft.kind === "event"
    ? eventOf(dependencies, { membership, draft, timeZone })
    : reminderOf(dependencies, { membership, draft, timeZone });
}
