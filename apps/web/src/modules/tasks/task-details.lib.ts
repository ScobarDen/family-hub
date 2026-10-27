import { offsetTitles } from "@family-hub/commands";
import type { Completion, Task } from "@family-hub/contract";
import { timeInZone } from "@family-hub/recurrence";

import { formatDate, formatDay, formatNearDate, type Viewer } from "@/common/format-date";

import { completionOf, momentOf, type OccurrenceStatus } from "./occurrences.lib.ts";
import { repeatTitles } from "./tasks.config.ts";

export type SubtaskRow = {
  id: string;
  title: string;
  subtitle: string | undefined;
  status: OccurrenceStatus;
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

function subtaskStatusOf(subtask: Task["subtasks"][number], today: string): OccurrenceStatus {
  if (subtask.completed !== null) {
    return "completed";
  }

  return subtask.assignees.length > 0 && subtask.date !== null && subtask.date < today
    ? "overdue"
    : "open";
}

function subtaskRowOf(subtask: Task["subtasks"][number], today: string): SubtaskRow {
  return {
    id: subtask.id,
    title: subtask.title,
    subtitle: joined([
      subtask.date === null ? undefined : formatNearDate(subtask.date, today),
      subtask.assignees.map(({ name }) => name).join(", "),
    ]),
    status: subtaskStatusOf(subtask, today),
  };
}

export function detailsOf(task: Task, occurrence: string | null, viewer: Viewer): TaskDetails {
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
    completed: completedText(completionOf(task, occurrence), viewer),
    isPrivate: task.visibility === "private",
    isRecurring: task.recurrence !== null,
    canDelete: task.isOwn,
    canAddSubtask: task.recurrence === null,
    stepsTitle: joined(["Шаги", progressOf(task)]) ?? "Шаги",
    subtasks: task.subtasks.map((subtask) => subtaskRowOf(subtask, viewer.today)),
    album: task.album,
  };
}
