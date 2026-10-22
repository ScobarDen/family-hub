import type { FeedUpcoming } from "@family-hub/contract";
import {
  birthdaysIn,
  dateInZone,
  dayAfter,
  dayBefore,
  occurrenceDates,
  occurrenceMoment,
  timeInZone,
} from "@family-hub/recurrence";

import { openDueDates } from "@/modules/care-entry";

import { stepTitle, visibleTrees } from "../feed.lib.ts";
import type {
  FeedDueRow,
  FeedEventRow,
  FeedPetRow,
  FeedPlanRow,
  FeedReminderRow,
} from "../feed.repo.ts";

export type Window = { today: string; last: string; timeZone: string };

type Split = { overdue: FeedUpcoming[]; upcoming: FeedUpcoming[] };

function isWithin(date: string, { today, last }: Window): boolean {
  return date >= today && date <= last;
}

function seriesOf(row: Pick<FeedEventRow, "frequency" | "until">) {
  return row.frequency === null ? null : { frequency: row.frequency, until: row.until };
}

// A timed Occurrence is a moment in the creator's zone, so it may fall on the viewer's next day.
function widened({ today, last }: Window) {
  return { from: dayBefore(today), to: dayAfter(last) };
}

type Placed<Moment> = { occurrence: string; date: string; moment: Moment };

// An all-day Occurrence keeps its date; a timed one falls on the viewer's day of its moment.
function inWindow<Moment extends number | undefined>(
  row: Pick<FeedEventRow, "startDate" | "frequency" | "until"> & { skippedDates?: string[] },
  {
    window,
    momentOf,
    toItem,
  }: {
    window: Window;
    momentOf: (occurrence: string) => Moment;
    toItem: (placed: Placed<Moment>) => FeedUpcoming;
  },
): FeedUpcoming[] {
  const dates = occurrenceDates(row.startDate, seriesOf(row), {
    range: widened(window),
    skipped: row.skippedDates,
  });

  return dates.flatMap((occurrence) => {
    const moment = momentOf(occurrence);
    const date = moment === undefined ? occurrence : dateInZone(moment, window.timeZone);

    return isWithin(date, window) ? [toItem({ occurrence, date, moment })] : [];
  });
}

export function eventUpcoming(row: FeedEventRow, window: Window): FeedUpcoming[] {
  const { startTime: time, timeZone } = row;

  return inWindow(row, {
    window,
    momentOf: (occurrence) =>
      time === null || timeZone === null
        ? undefined
        : occurrenceMoment(occurrence, { time, timeZone }),
    toItem: ({ occurrence, date, moment }) => ({
      kind: "event",
      key: `event-${row.id}-${occurrence}`,
      title: row.title,
      date,
      time: moment === undefined ? null : timeInZone(moment, window.timeZone),
      eventId: row.id,
    }),
  });
}

export function reminderUpcoming(row: FeedReminderRow, window: Window): FeedUpcoming[] {
  return inWindow(row, {
    window,
    momentOf: (occurrence) =>
      occurrenceMoment(occurrence, { time: row.startTime, timeZone: row.timeZone }),
    toItem: ({ occurrence, date, moment }) => ({
      kind: "reminder",
      key: `reminder-${row.id}-${occurrence}`,
      title: row.text,
      date,
      time: timeInZone(moment, window.timeZone),
      reminderId: row.id,
    }),
  });
}

export function birthdayUpcoming(pet: FeedPetRow, window: Window): FeedUpcoming[] {
  const { birthDate } = pet;

  if (birthDate === null) {
    return [];
  }

  return birthdaysIn(birthDate, { from: window.today, to: window.last }).map((date) => ({
    kind: "birthday",
    key: `birthday-${pet.id}-${date}`,
    title: `День рождения: ${pet.name}`,
    date,
    petId: pet.id,
  }));
}

function split(items: FeedUpcoming[], window: Window): Split {
  return {
    overdue: items.filter(({ date }) => date < window.today),
    upcoming: items.filter(({ date }) => isWithin(date, window)),
  };
}

export function planDeadlines(
  rows: FeedPlanRow[],
  { memberId, window }: { memberId: string; window: Window },
): Split {
  const items = visibleTrees(rows, memberId).flatMap(({ root, steps }) =>
    steps.flatMap((step): FeedUpcoming[] =>
      step.dueDate === null || step.completedAt !== null
        ? []
        : [
            {
              kind: "plan",
              key: `plan-${step.id}`,
              title: stepTitle(root, step),
              date: step.dueDate,
              planId: root.id,
              subplanId: step.id === root.id ? null : step.id,
            },
          ],
    ),
  );

  return split(items, window);
}

export function dueDeadlines(
  dues: FeedDueRow[],
  { pets, window }: { pets: FeedPetRow[]; window: Window },
): Split {
  const items = openDueDates({ pets, entries: dues }).map(
    ({ entryId, petId, title, dueDate }): FeedUpcoming => ({
      kind: "due",
      key: `due-${entryId}`,
      title,
      date: dueDate,
      petId,
      entryId,
    }),
  );

  return split(items, window);
}
