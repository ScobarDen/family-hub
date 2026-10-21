import type { EventReminderOffset } from "@family-hub/contract";
import {
  dayAfter,
  eventReminderMoment,
  firstOccurrenceFrom,
  occurrenceMoment,
} from "@family-hub/recurrence";

import { formatFloatingDate, formatMomentIn, reminderButtons, snoozeMs } from "../reminder.lib.ts";
import type { ReminderDependencies, Source } from "../reminder.types.ts";
import type { ReminderRow } from "../repo/reminder.repo.ts";
import type { EventRow } from "../repo/source.repo.ts";

type Series = { start: string; frequency: ReminderRow["frequency"]; until: string | null };

function seriesSteps({ start, frequency, until }: Series, skipped: string[] = []) {
  const recurrence = frequency === null ? null : { frequency, until };

  function from(day: string): string | undefined {
    const occurrence = firstOccurrenceFrom(start, recurrence, day);

    return occurrence !== undefined && skipped.includes(occurrence)
      ? from(dayAfter(occurrence))
      : occurrence;
  }

  return { first: from, next: (occurrence: string) => from(dayAfter(occurrence)) };
}

export function reminderSource(row: ReminderRow, recipientIds: string[]): Source {
  return {
    kind: "reminder",
    familyId: row.familyId,
    sourceId: row.id,
    recipientIds,
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
  };
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

// Each offset of an Event is a source of its own, so «Готово» on one leaves the others.
export async function eventSource(
  dependencies: ReminderDependencies,
  { row, offset }: { row: EventRow; offset: EventReminderOffset },
): Promise<Source> {
  const start = { date: row.startDate, time: row.startTime, timeZone: row.timeZone };

  return {
    kind: "event",
    familyId: row.familyId,
    sourceId: `${row.id}:${offset}`,
    recipientIds: await eventRecipients(dependencies, row),
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
