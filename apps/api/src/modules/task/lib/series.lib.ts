import {
  daysAfter,
  firstOccurrenceFrom,
  occurrencesOnDays,
  type PlacedOccurrence,
  type ZonedDays,
} from "@family-hub/recurrence";

import type { TaskRecord } from "../task.repo.ts";
import { occurrenceKey, recurrenceOf } from "./task.lib.ts";

function isOccurrence({ row }: TaskRecord, occurrence: string | null): boolean {
  const recurrence = recurrenceOf(row);

  if (recurrence === null) {
    return true;
  }

  return (
    row.date !== null &&
    occurrence !== null &&
    !row.skippedDates.includes(occurrence) &&
    firstOccurrenceFrom(row.date, recurrence, occurrence) === occurrence
  );
}

function isCompleted({ row, completions }: TaskRecord, occurrence: string | null): boolean {
  if (row.frequency !== null && occurrence === null) {
    return false;
  }

  const key = occurrenceKey(row, occurrence);

  return completions.some((completion) => completion.occurrence === key);
}

function isOpen(record: TaskRecord, occurrence: string | null): boolean {
  return isOccurrence(record, occurrence) && !isCompleted(record, occurrence);
}

function firstOpenFrom(record: TaskRecord, day: string): string | undefined {
  const { row } = record;
  const occurrence =
    row.date === null ? undefined : firstOccurrenceFrom(row.date, recurrenceOf(row), day);

  return occurrence === undefined || isOpen(record, occurrence)
    ? occurrence
    : firstOpenFrom(record, daysAfter(occurrence, 1));
}

function openOn<Moment extends number | undefined>(
  record: TaskRecord,
  { days, momentOf }: { days: ZonedDays; momentOf: (occurrence: string) => Moment },
): Array<PlacedOccurrence<Moment>> {
  const { row } = record;

  if (row.date === null) {
    return [];
  }

  return occurrencesOnDays(
    { startDate: row.date, recurrence: recurrenceOf(row), skipped: row.skippedDates },
    { days, momentOf },
  ).filter(({ occurrence }) => !isCompleted(record, occurrence));
}

// The Assignees by default, or the owner of a Task without them; a Private Task reaches its owner.
function recipientsOf({ row, assignees, recipients }: TaskRecord, familyMemberIds: string[]) {
  const owner = row.ownerMemberId === null ? [] : [row.ownerMemberId];

  if (row.recipientsMode === "members") {
    return recipients.map(({ id }) => id);
  }

  if (row.recipientsMode === "everyone") {
    return row.visibility === "private" ? owner : familyMemberIds;
  }

  return assignees.length > 0 ? assignees.map(({ id }) => id) : owner;
}

// What the Occurrences of a Task are and which of them are still open. A Task without a Recurrence
// has one Occurrence, which any date or `null` names.
export function taskSeries(record: TaskRecord) {
  return {
    isOccurrence: (occurrence: string | null) => isOccurrence(record, occurrence),
    isCompleted: (occurrence: string | null) => isCompleted(record, occurrence),
    isOpen: (occurrence: string | null) => isOpen(record, occurrence),
    first: (fromDay: string) => firstOpenFrom(record, fromDay),
    next: (occurrence: string) => firstOpenFrom(record, daysAfter(occurrence, 1)),
    openOn: <Moment extends number | undefined>(
      days: ZonedDays,
      momentOf: (occurrence: string) => Moment,
    ) => openOn(record, { days, momentOf }),
    recipients: (familyMemberIds: string[]): string[] => recipientsOf(record, familyMemberIds),
  };
}

export type TaskSeries = ReturnType<typeof taskSeries>;
