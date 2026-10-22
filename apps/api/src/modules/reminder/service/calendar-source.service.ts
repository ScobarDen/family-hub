import type { EventReminderOffset } from "@family-hub/contract";
import {
  daysAfter,
  eventReminderMoment,
  firstOccurrenceFrom,
  occurrenceMoment,
} from "@family-hub/recurrence";

import {
  formatFloatingDate,
  formatMomentIn,
  reminderButtons,
  snoozeMs,
  sourceIdOf,
} from "../reminder.lib.ts";
import type { SourceHolder, ReminderDependencies, Source } from "../reminder.types.ts";
import type { ReminderRow } from "../repo/reminder.repo.ts";
import type { EventRow } from "../repo/source.repo.ts";

type Series = { start: string; frequency: ReminderRow["frequency"]; until: string | null };

function seriesSteps({ start, frequency, until }: Series, skipped: string[] = []) {
  const recurrence = frequency === null ? null : { frequency, until };

  function from(day: string): string | undefined {
    const occurrence = firstOccurrenceFrom(start, recurrence, day);

    return occurrence !== undefined && skipped.includes(occurrence)
      ? from(daysAfter(occurrence, 1))
      : occurrence;
  }

  return { first: from, next: (occurrence: string) => from(daysAfter(occurrence, 1)) };
}

export async function reminderSources(
  { reminders }: ReminderDependencies,
  { familyId, id }: SourceHolder,
): Promise<Source[]> {
  const found = await reminders.find({ familyId, reminderId: id });

  if (found === undefined) {
    return [];
  }

  const { reminder: row, recipients } = found;

  return [
    {
      kind: "reminder",
      sourceId: sourceIdOf(row.id),
      recipientIds: recipients.map((recipient) => recipient.id),
      homeZone: row.timeZone,
      ...seriesSteps({ start: row.startDate, frequency: row.frequency, until: row.until }),
      // A standalone Reminder is one moment for everyone, set on its creator's clock.
      fireAt: (occurrence) =>
        occurrenceMoment(occurrence, { time: row.startTime, timeZone: row.timeZone }),
      emoji: "🔔",
      title: () => row.text,
      buttons: reminderButtons,
      closesForEveryone: true,
      snoozeMs,
      isSkippedWhenLate: true,
    },
  ];
}

function eventTitle(
  row: EventRow,
  { occurrence, timeZone }: { occurrence: string; timeZone: string },
) {
  if (row.startTime === null || row.timeZone === null) {
    return `${row.title} · ${formatFloatingDate(occurrence)}`;
  }

  const moment = occurrenceMoment(occurrence, { time: row.startTime, timeZone: row.timeZone });

  return `${row.title} · ${formatMomentIn(moment, timeZone)}`;
}

async function eventRecipients({ sources }: ReminderDependencies, row: EventRow) {
  return row.visibility === "private" && row.ownerMemberId !== null
    ? [row.ownerMemberId]
    : sources.memberIdsOf(row.familyId);
}

function eventSource(
  row: EventRow,
  { offset, recipientIds }: { offset: EventReminderOffset; recipientIds: string[] },
): Source {
  const start = { date: row.startDate, time: row.startTime, timeZone: row.timeZone };

  return {
    kind: "event",
    sourceId: sourceIdOf(row.id, offset),
    recipientIds,
    homeZone: row.timeZone ?? undefined,
    ...seriesSteps(
      { start: row.startDate, frequency: row.frequency, until: row.until },
      row.skippedDates,
    ),
    fireAt: (occurrence, timeZone) =>
      eventReminderMoment(occurrence, { start, offset, recipientZone: timeZone }),
    emoji: "📅",
    title: (occurrence, timeZone) => eventTitle(row, { occurrence, timeZone }),
    buttons: reminderButtons,
    closesForEveryone: true,
    snoozeMs,
    isSkippedWhenLate: true,
  };
}

// Each offset of an Event is a source of its own, so «Готово» on one leaves the others.
export async function eventSources(
  dependencies: ReminderDependencies,
  holder: SourceHolder,
): Promise<Source[]> {
  const row = await dependencies.sources.event(holder);

  if (row === undefined) {
    return [];
  }

  const recipientIds = await eventRecipients(dependencies, row);

  return row.reminderOffsets.map((offset) => eventSource(row, { offset, recipientIds }));
}
