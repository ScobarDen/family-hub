import { offsetTitles } from "@family-hub/commands";
import { overdueLookbackDays, type Completion, type Person, type Task } from "@family-hub/contract";
import {
  daysAfter,
  occurrenceMoment,
  occurrencesOnDays,
  timeInZone,
  type PlacedOccurrence,
} from "@family-hub/recurrence";

import { formatDate, formatDay, formatNearDate, type Viewer } from "@/common/format-date";

import { repeatTitles } from "./tasks.config.ts";

export type TaskRow = {
  key: string;
  taskId: string;
  occurrence: string | null;
  title: string;
  date: string | undefined;
  when: string | undefined;
  assignees: Person[];
  petPicture: string | undefined;
  isRecurring: boolean;
  hasReminder: boolean;
  isOverdue: boolean;
  isCompleted: boolean;
};

export type TaskGroups = {
  overdue: TaskRow[];
  today: TaskRow[];
  upcoming: TaskRow[];
  undated: TaskRow[];
  completed: TaskRow[];
};

const yearDays = 366;
const farPast = "1970-01-01";

// A Task without a Recurrence has one Occurrence, so its completion is any completion it has.
export function completionOf(task: Task, occurrence: string | null): Completion | undefined {
  return task.recurrence === null
    ? task.completions[0]
    : task.completions.find((completion) => completion.occurrence === occurrence);
}

// The one Overdue rule the server applies too: a past Occurrence of a Task with Assignees that is
// not Completed; a Task without Assignees never turns Overdue.
export function isOverdue(
  task: Task,
  {
    occurrence,
    date,
    today,
  }: { occurrence: string | null; date: string | undefined; today: string },
): boolean {
  return (
    date !== undefined &&
    date < today &&
    task.assignees.length > 0 &&
    completionOf(task, occurrence) === undefined
  );
}

function momentOf(task: Task) {
  const time = task.when?.time ?? null;
  const zone = task.when?.timeZone ?? null;

  return (occurrence: string) =>
    time === null || zone === null
      ? undefined
      : occurrenceMoment(occurrence, { time, timeZone: zone });
}

// Each Occurrence falls on the viewer's own day, a timed one possibly the day before or after.
export function placedOccurrences(
  task: Task,
  { from, to, timeZone }: { from: string; to: string; timeZone: string },
): Array<PlacedOccurrence<number | undefined>> {
  if (task.when === null) {
    return [];
  }

  return occurrencesOnDays(
    { startDate: task.when.date, recurrence: task.recurrence, skipped: task.skippedDates },
    { days: { from, to, timeZone }, momentOf: momentOf(task) },
  );
}

function whenText(
  { date, moment }: { date: string; moment: number | undefined },
  viewer: Viewer,
): string {
  const day = formatNearDate(date, viewer.today);

  return moment === undefined ? day : `${day}, ${timeInZone(moment, viewer.timeZone)}`;
}

type TaskMarks = Pick<
  TaskRow,
  "taskId" | "title" | "assignees" | "petPicture" | "isRecurring" | "hasReminder"
>;

function marksOf(task: Task): TaskMarks {
  return {
    taskId: task.id,
    title: task.title,
    assignees: task.assignees,
    petPicture: task.pet?.picture ?? undefined,
    isRecurring: task.recurrence !== null,
    hasReminder: task.reminderOffsets.length > 0,
  };
}

function rowOf(
  task: Task,
  placed: PlacedOccurrence<number | undefined> | undefined,
  viewer: Viewer,
): TaskRow {
  const occurrence = placed?.occurrence ?? null;

  return {
    ...marksOf(task),
    key: `${task.id}-${occurrence ?? "undated"}`,
    occurrence,
    date: placed?.date,
    when: placed === undefined ? undefined : whenText(placed, viewer),
    isOverdue: isOverdue(task, { occurrence, date: placed?.date, today: viewer.today }),
    isCompleted: completionOf(task, occurrence) !== undefined,
  };
}

// The rows a list shows of one Task: its single Occurrence, or of a series the past ones that
// matter, today's and the next one ahead.
export function rowsOf(task: Task, viewer: Viewer): TaskRow[] {
  if (task.when === null) {
    return [rowOf(task, undefined, viewer)];
  }

  const isSeries = task.recurrence !== null;
  const rows = placedOccurrences(task, {
    from: isSeries ? daysAfter(viewer.today, -overdueLookbackDays) : farPast,
    to: daysAfter(viewer.today, yearDays),
    timeZone: viewer.timeZone,
  }).map((placed) => rowOf(task, placed, viewer));

  if (!isSeries) {
    return rows;
  }

  const ahead = rows.find((row) => (row.date ?? "") > viewer.today && !row.isCompleted);

  return [
    ...rows.filter(
      (row) =>
        (row.date ?? "") <= viewer.today &&
        (row.isCompleted || row.isOverdue || row.date === viewer.today),
    ),
    ...(ahead === undefined ? [] : [ahead]),
  ];
}

function byDate(left: TaskRow, right: TaskRow): number {
  return `${left.date ?? ""}${left.when ?? ""}`.localeCompare(
    `${right.date ?? ""}${right.when ?? ""}`,
  );
}

export function groupsOf(rows: TaskRow[], today: string): TaskGroups {
  const open = rows.filter(({ isCompleted }) => !isCompleted).toSorted(byDate);

  return {
    overdue: open.filter((row) => row.isOverdue),
    today: open.filter(({ date }) => date === today),
    upcoming: open.filter(({ date }) => date !== undefined && date > today),
    undated: open.filter(({ date }) => date === undefined),
    completed: rows
      .filter(({ isCompleted }) => isCompleted)
      .toSorted(byDate)
      .toReversed(),
  };
}

// «Мои» are the Tasks the Member is to do or to be reminded of.
export function isMine(task: Task, memberId: string | undefined): boolean {
  const isAssignee = task.assignees.some(({ id }) => id === memberId);
  const hasReminder = task.reminderOffsets.length > 0;

  if (isAssignee) {
    return true;
  }

  if (!hasReminder) {
    return false;
  }

  if (task.recipients === "everyone") {
    return true;
  }

  return task.recipients === "default"
    ? task.assignees.length === 0 && task.isOwn
    : task.recipients.some(({ id }) => id === memberId);
}

export type SubtaskRow = {
  id: string;
  title: string;
  subtitle: string | undefined;
  isCompleted: boolean;
  isOverdue: boolean;
};

export type TaskDetails = {
  id: string;
  title: string;
  occurrence: string | null;
  when: string | undefined;
  repeats: string | undefined;
  facts: string | undefined;
  reminders: string | undefined;
  note: string | undefined;
  completed: string | undefined;
  isCompleted: boolean;
  isPrivate: boolean;
  isRecurring: boolean;
  canDelete: boolean;
  canAddSubtask: boolean;
  stepsTitle: string;
  subtasks: SubtaskRow[];
  album: Task["album"];
};

function joined(parts: Array<string | undefined>): string | undefined {
  const present = parts.filter((part) => part !== undefined && part !== "");

  return present.length === 0 ? undefined : present.join(" · ");
}

function detailsWhen(task: Task, occurrence: string | null, viewer: Viewer): string | undefined {
  const { when } = task;

  if (when === null) {
    return undefined;
  }

  const day = occurrence ?? when.date;
  const moment = momentOf(task)(day);

  if (moment === undefined) {
    const end =
      when.endDate === null || when.endDate === when.date ? "" : ` — ${formatDate(when.endDate)}`;

    return `${formatDate(day)}${end}`;
  }

  const end = when.endTime === null ? "" : `–${when.endTime}`;

  return `${formatDay(moment, viewer)}, ${timeInZone(moment, viewer.timeZone)}${end}`;
}

function repeatsOf({ recurrence }: Task): string | undefined {
  if (recurrence === null) {
    return undefined;
  }

  const until = recurrence.until === null ? "" : ` до ${formatDate(recurrence.until)}`;

  return `${repeatTitles[recurrence.frequency]}${until}`;
}

function completedText(completion: Completion | undefined, viewer: Viewer): string | undefined {
  return completion === undefined
    ? undefined
    : `Выполнено ${joined([formatDay(completion.at, viewer), completion.by ?? undefined])}`;
}

function progressOf({ subtasks }: Task): string | undefined {
  const done = subtasks.filter(({ completed }) => completed !== null).length;

  return subtasks.length === 0 ? undefined : `${done} из ${subtasks.length}`;
}

function subtaskRowOf(subtask: Task["subtasks"][number], today: string): SubtaskRow {
  const isOpen = subtask.completed === null;

  return {
    id: subtask.id,
    title: subtask.title,
    subtitle: joined([
      subtask.date === null ? undefined : formatNearDate(subtask.date, today),
      subtask.assignees.map(({ name }) => name).join(", "),
    ]),
    isCompleted: !isOpen,
    isOverdue:
      isOpen && subtask.assignees.length > 0 && subtask.date !== null && subtask.date < today,
  };
}

export function detailsOf(task: Task, occurrence: string | null, viewer: Viewer): TaskDetails {
  const completion = completionOf(task, occurrence);

  return {
    id: task.id,
    title: task.title,
    occurrence,
    when: detailsWhen(task, occurrence, viewer),
    repeats: repeatsOf(task),
    facts: joined([task.assignees.map(({ name }) => name).join(", "), task.pet?.name]),
    reminders:
      task.reminderOffsets.length === 0
        ? undefined
        : `Напомнить ${task.reminderOffsets.map((offset) => offsetTitles[offset]).join(", ")}`,
    note: task.note ?? undefined,
    completed: completedText(completion, viewer),
    isCompleted: completion !== undefined,
    isPrivate: task.visibility === "private",
    isRecurring: task.recurrence !== null,
    canDelete: task.isOwn,
    canAddSubtask: task.recurrence === null,
    stepsTitle: joined(["Шаги", progressOf(task)]) ?? "Шаги",
    subtasks: task.subtasks.map((subtask) => subtaskRowOf(subtask, viewer.today)),
    album: task.album,
  };
}

// The Occurrence a Task opens on when nobody named one: the next open one, or its first.
export function nextOccurrenceOf(task: Task, viewer: Viewer): string | null {
  if (task.when === null) {
    return null;
  }

  const next = rowsOf(task, viewer).find(({ isCompleted }) => !isCompleted);

  return next?.occurrence ?? task.when.date;
}
