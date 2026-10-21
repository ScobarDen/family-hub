import type { FeedUpcoming } from "@family-hub/contract";
import {
  dateInZone,
  dayAfter,
  dayBefore,
  occurrenceDates,
  occurrenceMoment,
  timeInZone,
} from "@family-hub/recurrence";

import { careTitleOf, stepTitle, visibleTrees } from "../feed.lib.ts";
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

export function eventUpcoming(row: FeedEventRow, window: Window): FeedUpcoming[] {
  const dates = occurrenceDates(row.startDate, seriesOf(row), {
    range: widened(window),
    skipped: row.skippedDates,
  });

  return dates.flatMap((occurrence): FeedUpcoming[] => {
    const moment =
      row.startTime === null || row.timeZone === null
        ? undefined
        : occurrenceMoment(occurrence, { time: row.startTime, timeZone: row.timeZone });
    const date = moment === undefined ? occurrence : dateInZone(moment, window.timeZone);
    const item: FeedUpcoming = {
      kind: "event",
      key: `event-${row.id}-${occurrence}`,
      title: row.title,
      date,
      time: moment === undefined ? null : timeInZone(moment, window.timeZone),
      eventId: row.id,
    };

    return isWithin(date, window) ? [item] : [];
  });
}

export function reminderUpcoming(row: FeedReminderRow, window: Window): FeedUpcoming[] {
  return occurrenceDates(row.startDate, seriesOf(row), { range: widened(window) }).flatMap(
    (occurrence): FeedUpcoming[] => {
      const moment = occurrenceMoment(occurrence, { time: row.startTime, timeZone: row.timeZone });
      const date = dateInZone(moment, window.timeZone);
      const item: FeedUpcoming = {
        kind: "reminder",
        key: `reminder-${row.id}-${occurrence}`,
        title: row.text,
        date,
        time: timeInZone(moment, window.timeZone),
        reminderId: row.id,
      };

      return isWithin(date, window) ? [item] : [];
    },
  );
}

export function birthdayUpcoming(pet: FeedPetRow, window: Window): FeedUpcoming[] {
  const { birthDate } = pet;

  if (birthDate === null) {
    return [];
  }

  const dates = occurrenceDates(
    birthDate,
    { frequency: "yearly", until: null },
    { range: { from: window.today, to: window.last } },
  );

  return dates
    .filter((date) => date !== birthDate)
    .map((date) => ({
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

// The newest entry of each due key holds its Due Date; a later one of the same key closes it.
export function dueDeadlines(
  dues: FeedDueRow[],
  { pets, window }: { pets: FeedPetRow[]; window: Window },
): Split {
  const names = new Map(pets.map(({ id, name }) => [id, name]));
  const newest = new Map<string, FeedDueRow>();

  for (const due of dues) {
    const key = `${due.petId}:${due.dueKey}`;

    if (names.has(due.petId) && !newest.has(key)) {
      newest.set(key, due);
    }
  }

  const items = [...newest.values()].flatMap((due): FeedUpcoming[] =>
    due.dueDate === null
      ? []
      : [
          {
            kind: "due",
            key: `due-${due.id}`,
            title: `${careTitleOf(due.details)} — ${names.get(due.petId) ?? ""}`,
            date: due.dueDate,
            petId: due.petId,
            entryId: due.id,
          },
        ],
  );

  return split(items, window);
}
