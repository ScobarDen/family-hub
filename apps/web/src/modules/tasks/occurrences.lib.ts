import type { Completion, Task } from "@family-hub/contract";
import { occurrenceMoment, occurrencesOnDays, type PlacedOccurrence } from "@family-hub/recurrence";

export type OccurrenceStatus = "open" | "overdue" | "completed";

// A Task without a Recurrence has one Occurrence, so its completion is any completion it has.
export function completionOf(task: Task, occurrence: string | null): Completion | undefined {
  return task.recurrence === null
    ? task.completions[0]
    : task.completions.find((completion) => completion.occurrence === occurrence);
}

// The one Overdue rule the server applies too: a past Occurrence of a Task with Assignees that is
// not Completed; a Task without Assignees never turns Overdue.
export function statusOf(
  task: Task,
  {
    occurrence,
    date,
    today,
  }: { occurrence: string | null; date: string | undefined; today: string },
): OccurrenceStatus {
  if (completionOf(task, occurrence) !== undefined) {
    return "completed";
  }

  return date !== undefined && date < today && task.assignees.length > 0 ? "overdue" : "open";
}

export function momentOf(task: Task) {
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
