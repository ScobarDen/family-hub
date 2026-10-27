import { overdueLookbackDays, type Person, type Pet, type Task } from "@family-hub/contract";
import { daysAfter, timeInZone, type PlacedOccurrence } from "@family-hub/recurrence";

import { formatNearDate, type Viewer } from "@/common/format-date";

import { birthdaysOf } from "./calendar.lib.ts";
import { placedOccurrences, statusOf, type OccurrenceStatus } from "./occurrences.lib.ts";

export type TaskRow = {
  kind: "task";
  key: string;
  taskId: string;
  occurrence: string | null;
  title: string;
  date: string | undefined;
  when: string | undefined;
  subtitle: string | undefined;
  assignees: Person[];
  assigneesLabel: string | undefined;
  petPicture: string | undefined;
  isRecurring: boolean;
  hasReminder: boolean;
  status: OccurrenceStatus;
};

// A birthday is never done or late; it only stands among the Tasks of its day.
export type BirthdayRow = {
  kind: "birthday";
  key: string;
  petId: string;
  title: string;
  date: string;
  when: string;
  status: "open";
};

export type ListRow = TaskRow | BirthdayRow;

export type TaskGroups<Row extends ListRow = ListRow> = {
  overdue: Row[];
  today: Row[];
  upcoming: Row[];
  undated: Row[];
  completed: Row[];
};

const yearDays = 366;
const farPast = "1970-01-01";

function whenText(
  { date, moment }: { date: string; moment: number | undefined },
  viewer: Viewer,
): string {
  const day = formatNearDate(date, viewer.today);

  return moment === undefined ? day : `${day}, ${timeInZone(moment, viewer.timeZone)}`;
}

type TaskMarks = Pick<
  TaskRow,
  "taskId" | "title" | "assignees" | "assigneesLabel" | "petPicture" | "isRecurring" | "hasReminder"
>;

function marksOf(task: Task): TaskMarks {
  return {
    taskId: task.id,
    title: task.title,
    assignees: task.assignees,
    assigneesLabel:
      task.assignees.length === 0
        ? undefined
        : `Исполнители: ${task.assignees.map(({ name }) => name).join(", ")}`,
    petPicture: task.pet?.picture ?? undefined,
    isRecurring: task.recurrence !== null,
    hasReminder: task.reminderOffsets.length > 0,
  };
}

// Overdue reads in words as well as in red, so it does not rest on colour alone.
// The Pet is named too, as two Pets' vaccinations would otherwise read the same.
function subtitleOf(
  task: Task,
  { status, when }: { status: OccurrenceStatus; when: string | undefined },
): string | undefined {
  const present = [status === "overdue" ? "Просрочено" : undefined, when, task.pet?.name].filter(
    (part) => part !== undefined,
  );

  return present.length === 0 ? undefined : present.join(" · ");
}

function rowOf(
  task: Task,
  placed: PlacedOccurrence<number | undefined> | undefined,
  viewer: Viewer,
): TaskRow {
  const occurrence = placed?.occurrence ?? null;
  const when = placed === undefined ? undefined : whenText(placed, viewer);
  const status = statusOf(task, { occurrence, date: placed?.date, today: viewer.today });

  return {
    kind: "task",
    ...marksOf(task),
    key: `${task.id}-${occurrence ?? "undated"}`,
    occurrence,
    date: placed?.date,
    when,
    subtitle: subtitleOf(task, { status, when }),
    status,
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

  const ahead = rows.find((row) => (row.date ?? "") > viewer.today && row.status !== "completed");

  return [
    ...rows.filter(
      (row) =>
        (row.date ?? "") <= viewer.today && (row.status !== "open" || row.date === viewer.today),
    ),
    ...(ahead === undefined ? [] : [ahead]),
  ];
}

// Each Pet's next birthday, as the calendar shows it.
export function birthdayRowsOf(pets: Pet[], today: string): BirthdayRow[] {
  const range = { from: today, to: daysAfter(today, yearDays) };

  return pets.flatMap((pet) =>
    birthdaysOf(pet, range)
      .slice(0, 1)
      .map(({ key, petId, title, date }) => ({
        kind: "birthday" as const,
        key,
        petId,
        title,
        date,
        when: formatNearDate(date, today),
        status: "open" as const,
      })),
  );
}

function byDate(left: ListRow, right: ListRow): number {
  return `${left.date ?? ""}${left.when ?? ""}`.localeCompare(
    `${right.date ?? ""}${right.when ?? ""}`,
  );
}

export function groupsOf<Row extends ListRow>(rows: Row[], today: string): TaskGroups<Row> {
  const open = rows.filter(({ status }) => status !== "completed").toSorted(byDate);

  return {
    overdue: open.filter(({ status }) => status === "overdue"),
    today: open.filter(({ date }) => date === today),
    upcoming: open.filter(({ date }) => date !== undefined && date > today),
    undated: open.filter(({ date }) => date === undefined),
    completed: rows
      .filter(({ status }) => status === "completed")
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

// The Occurrence a Task opens on when nobody named one: the next open one, or its first.
export function nextOccurrenceOf(task: Task, viewer: Viewer): string | null {
  if (task.when === null) {
    return null;
  }

  const next = rowsOf(task, viewer).find(({ status }) => status !== "completed");

  return next?.occurrence ?? task.when.date;
}
