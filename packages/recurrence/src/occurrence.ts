import { Temporal } from "temporal-polyfill";

import type { Recurrence } from "@family-hub/contract";

type Frequency = Recurrence["frequency"];

export type DateRange = { from: string; to: string };

function stepOf(frequency: Frequency, index: number): Temporal.DurationLike {
  if (frequency === "weekly") {
    return { weeks: index };
  }

  return frequency === "monthly" ? { months: index } : { years: index };
}

// Each Occurrence counts from the start, not from the one before, so the 31st falls on the last day
// of a short month and comes back to the 31st after it.
export function nthOccurrence(start: string, frequency: Frequency, index: number): string {
  return Temporal.PlainDate.from(start)
    .add(stepOf(frequency, index), { overflow: "constrain" })
    .toString();
}

function isBefore(left: string, right: string): boolean {
  return Temporal.PlainDate.compare(left, right) < 0;
}

function lastDateOf(range: DateRange, recurrence: Recurrence): string {
  return recurrence.until !== null && isBefore(recurrence.until, range.to)
    ? recurrence.until
    : range.to;
}

const unitOf = { weekly: "weeks", monthly: "months", yearly: "years" } as const;

function startingIndex(start: string, frequency: Frequency, date: string): number {
  const unit = unitOf[frequency];
  const elapsed = Temporal.PlainDate.from(start).until(date, { largestUnit: unit })[unit];

  return Math.max(0, elapsed - 1);
}

// The first date of a series on or after a given day, or undefined once the series has ended.
export function firstOccurrenceFrom(
  start: string,
  recurrence: Recurrence | null,
  date: string,
): string | undefined {
  if (recurrence === null) {
    return isBefore(start, date) ? undefined : start;
  }

  let index = isBefore(start, date) ? startingIndex(start, recurrence.frequency, date) : 0;
  let occurrence = nthOccurrence(start, recurrence.frequency, index);

  while (isBefore(occurrence, date)) {
    index += 1;
    occurrence = nthOccurrence(start, recurrence.frequency, index);
  }

  return recurrence.until !== null && isBefore(recurrence.until, occurrence)
    ? undefined
    : occurrence;
}

export function daysAfter(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}

// The dates of a series inside a range of calendar days, both ends included, skipped dates left out.
function singleDate(start: string, { range, skipped }: { range: DateRange; skipped: string[] }) {
  const isOutside = isBefore(start, range.from) || isBefore(range.to, start);

  return isOutside || skipped.includes(start) ? [] : [start];
}

export function occurrenceDates(
  start: string,
  recurrence: Recurrence | null,
  { range, skipped = [] }: { range: DateRange; skipped?: string[] },
): string[] {
  if (recurrence === null) {
    return singleDate(start, { range, skipped });
  }

  const last = lastDateOf(range, recurrence);
  const dates: string[] = [];
  const first = startingIndex(start, recurrence.frequency, range.from);

  for (
    let index = first, date = nthOccurrence(start, recurrence.frequency, first);
    !isBefore(last, date);
    index += 1, date = nthOccurrence(start, recurrence.frequency, index)
  ) {
    if (!isBefore(date, range.from) && !skipped.includes(date)) {
      dates.push(date);
    }
  }

  return dates;
}

// A timed Occurrence happens at its wall-clock time in the creator's zone, so a weekly 19:00 call
// stays at 19:00 for them across a daylight-saving change.
export function occurrenceMoment(
  date: string,
  { time, timeZone }: { time: string; timeZone: string },
): number {
  return Temporal.PlainDate.from(date).toZonedDateTime({
    timeZone,
    plainTime: Temporal.PlainTime.from(time),
  }).epochMilliseconds;
}

export function dateInZone(epochMs: number, timeZone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString();
}

export function timeInZone(epochMs: number, timeZone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainTime()
    .toString({ smallestUnit: "minute" });
}

export type ZonedDays = DateRange & { timeZone: string };

type Series = { startDate: string; recurrence: Recurrence | null; skipped?: string[] };

export type PlacedOccurrence<Moment> = { occurrence: string; date: string; moment: Moment };

// An all-day Occurrence keeps its date; a timed one is a moment in its creator's zone and falls on
// the viewer's day of that moment, possibly the day before or after its own date.
export function occurrencesOnDays<Moment extends number | undefined>(
  { startDate, recurrence, skipped }: Series,
  { days, momentOf }: { days: ZonedDays; momentOf: (occurrence: string) => Moment },
): Array<PlacedOccurrence<Moment>> {
  const range = { from: daysAfter(days.from, -1), to: daysAfter(days.to, 1) };

  return occurrenceDates(startDate, recurrence, { range, skipped }).flatMap((occurrence) => {
    const moment = momentOf(occurrence);
    const date = moment === undefined ? occurrence : dateInZone(moment, days.timeZone);

    return date >= days.from && date <= days.to ? [{ occurrence, date, moment }] : [];
  });
}
