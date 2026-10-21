import { Temporal } from "temporal-polyfill";

import type { CalendarEvent, DueDateItem, Pet, Reminder } from "@family-hub/contract";
import {
  dateInZone,
  occurrenceDates,
  occurrenceMoment,
  timeInZone,
  type DateRange,
} from "@family-hub/recurrence";

import { formatAge } from "@/common/format-date";

export type PetDue = DueDateItem & { petId: string; petName: string };

export type CalendarItem =
  | {
      kind: "event";
      key: string;
      date: string;
      time: string | undefined;
      title: string;
      eventId: string;
      occurrence: string;
    }
  | { kind: "reminder"; key: string; date: string; time: string; title: string; reminderId: string }
  | { kind: "birthday"; key: string; date: string; time: undefined; title: string; petId: string }
  | {
      kind: "due";
      key: string;
      date: string;
      time: undefined;
      title: string;
      petId: string;
      isOverdue: boolean;
    };

export type DayCell = {
  date: string;
  day: number;
  isInMonth: boolean;
  isToday: boolean;
  hasItems: boolean;
};

const daysPerWeek = 7;

const dueTitles = {
  vaccination: "Прививка",
  treatment: "Обработка",
  vet_visit: "Ветеринар",
} as const;

function widened({ from, to }: DateRange): DateRange {
  return {
    from: Temporal.PlainDate.from(from).subtract({ days: 1 }).toString(),
    to: Temporal.PlainDate.from(to).add({ days: 1 }).toString(),
  };
}

function isWithin(date: string, { from, to }: DateRange): boolean {
  return date >= from && date <= to;
}

// A timed Occurrence is a moment set in the creator's zone, shown on the viewer's own day and clock.
function eventItems(event: CalendarEvent, range: DateRange, viewerZone: string): CalendarItem[] {
  const { start } = event;
  const searched = start.time === null ? range : widened(range);
  const dates = occurrenceDates(start.date, event.recurrence, {
    range: searched,
    skipped: event.skippedDates,
  });

  return dates.flatMap((occurrence) => {
    const moment =
      start.time === null || start.timeZone === null
        ? undefined
        : occurrenceMoment(occurrence, { time: start.time, timeZone: start.timeZone });
    const date = moment === undefined ? occurrence : dateInZone(moment, viewerZone);
    const item: CalendarItem = {
      kind: "event",
      key: `event-${event.id}-${occurrence}`,
      date,
      time: moment === undefined ? undefined : timeInZone(moment, viewerZone),
      title: event.title,
      eventId: event.id,
      occurrence,
    };

    return isWithin(date, range) ? [item] : [];
  });
}

function reminderItems(reminder: Reminder, range: DateRange, viewerZone: string): CalendarItem[] {
  const { start } = reminder;

  return occurrenceDates(start.date, reminder.recurrence, { range: widened(range) }).flatMap(
    (occurrence) => {
      const moment = occurrenceMoment(occurrence, start);
      const date = dateInZone(moment, viewerZone);
      const item: CalendarItem = {
        kind: "reminder",
        key: `reminder-${reminder.id}-${occurrence}`,
        date,
        time: timeInZone(moment, viewerZone),
        title: reminder.text,
        reminderId: reminder.id,
      };

      return isWithin(date, range) ? [item] : [];
    },
  );
}

function birthdayItems(pet: Pet, range: DateRange): CalendarItem[] {
  if (pet.birthDate === null || pet.archivedAt !== null) {
    return [];
  }

  return occurrenceDates(pet.birthDate, { frequency: "yearly", until: null }, { range })
    .filter((date) => date !== pet.birthDate)
    .map((date) => ({
      kind: "birthday",
      key: `birthday-${pet.id}-${date}`,
      date,
      time: undefined,
      title: `День рождения: ${pet.name}, ${formatAge(pet.birthDate ?? date, date)}`,
      petId: pet.id,
    }));
}

function dueItems(dues: PetDue[], range: DateRange): CalendarItem[] {
  return dues
    .filter(({ dueDate }) => isWithin(dueDate, range))
    .map((due) => ({
      kind: "due",
      key: `due-${due.entryId}`,
      date: due.dueDate,
      time: undefined,
      title: `${dueTitles[due.kind]}: ${due.petName}${due.kind === "vet_visit" ? "" : `, ${due.title}`}`,
      petId: due.petId,
      isOverdue: due.isOverdue,
    }));
}

export function itemsIn(
  {
    events,
    reminders,
    pets,
    dues,
  }: { events: CalendarEvent[]; reminders: Reminder[]; pets: Pet[]; dues: PetDue[] },
  { range, timeZone }: { range: DateRange; timeZone: string },
): CalendarItem[] {
  return [
    ...events.flatMap((event) => eventItems(event, range, timeZone)),
    ...reminders.flatMap((reminder) => reminderItems(reminder, range, timeZone)),
    ...pets.flatMap((pet) => birthdayItems(pet, range)),
    ...dueItems(dues, range),
  ].toSorted((left, right) =>
    left.date === right.date
      ? (left.time ?? "").localeCompare(right.time ?? "")
      : left.date.localeCompare(right.date),
  );
}

// Weeks start on Monday and the grid always shows whole weeks around the month.
export function monthRangeOf(month: string): DateRange {
  const first = Temporal.PlainYearMonth.from(month).toPlainDate({ day: 1 });
  const start = first.subtract({ days: first.dayOfWeek - 1 });
  const last = first.add({ months: 1 }).subtract({ days: 1 });
  const end = last.add({ days: daysPerWeek - last.dayOfWeek });

  return { from: start.toString(), to: end.toString() };
}

export function monthGrid(
  month: string,
  { today, items }: { today: string; items: CalendarItem[] },
): DayCell[] {
  const { from, to } = monthRangeOf(month);
  const busy = new Set(items.map(({ date }) => date));
  const cells: DayCell[] = [];

  for (
    let date = Temporal.PlainDate.from(from);
    date.toString() <= to;
    date = date.add({ days: 1 })
  ) {
    const iso = date.toString();

    cells.push({
      date: iso,
      day: date.day,
      isInMonth: iso.startsWith(month),
      isToday: iso === today,
      hasItems: busy.has(iso),
    });
  }

  return cells;
}

export function monthTitle(month: string): string {
  const title = Temporal.PlainYearMonth.from(month)
    .toPlainDate({ day: 1 })
    .toLocaleString("ru-RU", { month: "long", year: "numeric" })
    .replace(" г.", "");

  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function shiftMonth(month: string, months: number): string {
  return Temporal.PlainYearMonth.from(month).add({ months }).toString();
}

export function daysAfter(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
