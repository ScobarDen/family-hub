import { encodeRecordLink, type ReminderOffset } from "@family-hub/contract";
import {
  dateInZone,
  occurrenceMoment,
  taskReminderMoment,
  timeInZone,
} from "@family-hub/recurrence";

import type { RemindingTask } from "@/modules/task";

import type {
  PushText,
  ReminderKind,
  ReminderSchedule,
  ReminderSource,
} from "../reminder.types.ts";
import {
  dayLabelOf,
  daySnoozeMs,
  formatFloatingDate,
  formatMomentIn,
  reminderButtons,
  snoozeMs,
  sourceIdOf,
} from "./reminder.lib.ts";

type RemindedTask = RemindingTask["task"];

type RemindedSeries = Pick<RemindingTask["series"], "first" | "next">;

export type TaskSourcing = { offset: ReminderOffset; chatLink: string; openUrl: string };

function titleOf(
  { title, when }: RemindedTask,
  { occurrence, timeZone }: { occurrence: string; timeZone: string },
) {
  if (when.time === null || when.timeZone === null) {
    return `${title} · ${formatFloatingDate(occurrence)}`;
  }

  const moment = occurrenceMoment(occurrence, { time: when.time, timeZone: when.timeZone });

  return `${title} · ${formatMomentIn(moment, timeZone)}`;
}

// «Сегодня, 18:00» on the Recipient's clock, or the day alone for a date-only Task.
function dayAndTimeOf(
  { when }: RemindedTask,
  { occurrence, timeZone, now }: { occurrence: string; timeZone: string; now: number },
): string {
  const today = dateInZone(now, timeZone);

  if (when.time === null || when.timeZone === null) {
    return dayLabelOf(occurrence, today);
  }

  const moment = occurrenceMoment(occurrence, { time: when.time, timeZone: when.timeZone });

  return `${dayLabelOf(dateInZone(moment, timeZone), today)}, ${timeInZone(moment, timeZone)}`;
}

type Reminded = Omit<RemindingTask, "series"> & { series: RemindedSeries };

function taskSchedule(
  { task, series, recipientIds }: Reminded,
  offset: ReminderOffset,
): ReminderSchedule {
  return {
    kind: "task",
    sourceId: sourceIdOf(task.id, offset),
    recipientIds,
    homeZone: task.when.timeZone ?? undefined,
    first: series.first,
    next: series.next,
    fireAt: (occurrence, timeZone) =>
      taskReminderMoment(occurrence, { when: task.when, offset, recipientZone: timeZone }),
  };
}

// A Pet-linked Task offers to record a Care Entry; a Push says what in its title and when in its
// body.
function taskKind(
  { task, series }: Reminded,
  { chatLink, openUrl }: Omit<TaskSourcing, "offset">,
): ReminderKind {
  const section = task.pet?.name ?? "Дела";

  function recordUrlOf(occurrence: string): string | undefined {
    return task.petId === null
      ? undefined
      : `${chatLink}?startapp=${encodeRecordLink({ taskId: task.id, occurrence })}`;
  }

  return {
    emoji: task.petId === null ? "📌" : "🐾",
    title: (occurrence, timeZone) => titleOf(task, { occurrence, timeZone }),
    pushText: (occurrence, { timeZone, now }): PushText => ({
      title: task.title,
      body: `${dayAndTimeOf(task, { occurrence, timeZone, now })} · ${section}`,
    }),
    buttons: (dispatchId, occurrence) =>
      reminderButtons(dispatchId, { recordUrl: recordUrlOf(occurrence), openUrl }),
    deepLink: { kind: "task", id: task.id },
    closing: {
      by: "task",
      taskId: task.id,
      isClosed: (occurrence) => series.first(occurrence) !== occurrence,
    },
    snoozeMs: task.when.time === null ? daySnoozeMs : snoozeMs,
    content: async () => ({ status: "headline" }),
  };
}

// Each offset of a Task is a source of its own with rows of its own.
export function taskSource(reminded: Reminded, { offset, ...links }: TaskSourcing): ReminderSource {
  return { schedule: taskSchedule(reminded, offset), kind: taskKind(reminded, links) };
}
