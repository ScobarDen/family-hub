import { Temporal } from "temporal-polyfill";

import type { Pet, Task } from "@family-hub/contract";
import { birthdaysIn, timeInZone, type DateRange } from "@family-hub/recurrence";

import { formatAge } from "@/common/format-date.lib.ts";

import { placedOccurrences, statusOf, type OccurrenceStatus } from "./occurrences.lib.ts";

export type CalendarItem =
  | {
      kind: "task";
      key: string;
      date: string;
      time: string | undefined;
      title: string;
      taskId: string;
      occurrence: string;
      status: OccurrenceStatus;
    }
  | Birthday;

type Birthday = {
  kind: "birthday";
  key: string;
  date: string;
  time: undefined;
  title: string;
  petId: string;
};

export type CalendarViewer = { range: DateRange; timeZone: string; today: string };

export type DayCell = {
  date: string;
  day: number;
  isInMonth: boolean;
  isToday: boolean;
  hasItems: boolean;
  label: string;
};

const daysPerWeek = 7;

function taskItems(task: Task, { range, timeZone, today }: CalendarViewer): CalendarItem[] {
  return placedOccurrences(task, { ...range, timeZone }).map(({ occurrence, date, moment }) => ({
    kind: "task",
    key: `task-${task.id}-${occurrence}`,
    date,
    time: moment === undefined ? undefined : timeInZone(moment, timeZone),
    title: task.title,
    taskId: task.id,
    occurrence,
    status: statusOf(task, { occurrence, date, today }),
  }));
}

// A birthday is the Pet's own date, edited on its card; it only shows beside the Tasks.
export function birthdaysOf(pet: Pet, range: DateRange): Birthday[] {
  if (pet.birthDate === null || pet.archivedAt !== null) {
    return [];
  }

  const { birthDate } = pet;

  return birthdaysIn(birthDate, range).map((date) => ({
    kind: "birthday",
    key: `birthday-${pet.id}-${date}`,
    date,
    time: undefined,
    title: `День рождения: ${pet.name}, ${formatAge(birthDate, date)}`,
    petId: pet.id,
  }));
}

export function itemsIn(
  { tasks, pets }: { tasks: Task[]; pets: Pet[] },
  viewer: CalendarViewer,
): CalendarItem[] {
  return [
    ...tasks.flatMap((task) => taskItems(task, viewer)),
    ...pets.flatMap((pet) => birthdaysOf(pet, viewer.range)),
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
    const hasItems = busy.has(iso);
    const name = date.toLocaleString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

    cells.push({
      date: iso,
      day: date.day,
      isInMonth: iso.startsWith(month),
      isToday: iso === today,
      hasItems,
      label: hasItems ? `${name}, есть дела` : name,
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

export type AgendaRow = {
  item: CalendarItem;
  subtitle: string;
  time: string;
};

function subtitleOf(item: CalendarItem): string {
  if (item.kind === "birthday") {
    return "День рождения";
  }

  if (item.status === "overdue") {
    return "просрочено";
  }

  return item.status === "completed" ? "Выполнено" : "";
}

export function agendaRowsOf(items: CalendarItem[]): AgendaRow[] {
  return items.map((item) => ({
    item,
    subtitle: subtitleOf(item),
    time: item.time ?? "весь день",
  }));
}
