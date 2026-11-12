import { encodeRecordLink, type ReminderOffset } from "@family-hub/contract";
import {
  dateInZone,
  occurrenceMoment,
  taskReminderMoment,
  timeInZone,
} from "@family-hub/recurrence";

import type { RemindingTask } from "@/modules/task";

import {
  dayLabelOf,
  daySnoozeMs,
  formatFloatingDate,
  formatMomentIn,
  reminderButtons,
  snoozeMs,
  sourceIdOf,
} from "../reminder.lib.ts";
import type { PushText, ReminderDependencies, Source, SourceHolder } from "../reminder.types.ts";

type RemindedTask = RemindingTask["task"];

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

function taskPushText(
  task: RemindedTask,
  { section, ...when }: { occurrence: string; timeZone: string; now: number; section: string },
): PushText {
  return { title: task.title, body: `${dayAndTimeOf(task, when)} · ${section}` };
}

type Sourcing = {
  offset: ReminderOffset;
  chatLink: string;
  openUrl: string;
};

function taskSource(
  dependencies: ReminderDependencies,
  { reminding, sourcing }: { reminding: RemindingTask; sourcing: Sourcing },
): Source {
  const { task, series, recipientIds } = reminding;
  const { offset, chatLink, openUrl } = sourcing;
  const section = task.pet?.name ?? "Дела";

  function recordUrlOf(occurrence: string): string | undefined {
    return task.petId === null
      ? undefined
      : `${chatLink}?startapp=${encodeRecordLink({ taskId: task.id, occurrence })}`;
  }

  return {
    kind: "task",
    sourceId: sourceIdOf(task.id, offset),
    recipientIds,
    homeZone: task.when.timeZone ?? undefined,
    first: series.first,
    next: series.next,
    isClosed: (occurrence) => series.first(occurrence) !== occurrence,
    fireAt: (occurrence, timeZone) =>
      taskReminderMoment(occurrence, { when: task.when, offset, recipientZone: timeZone }),
    emoji: task.petId === null ? "📌" : "🐾",
    title: (occurrence, timeZone) => titleOf(task, { occurrence, timeZone }),
    pushOf: (occurrence, timeZone) =>
      taskPushText(task, { occurrence, timeZone, now: dependencies.clock.now(), section }),
    buttons: (dispatchId, occurrence) =>
      reminderButtons(dispatchId, {
        recordUrl: recordUrlOf(occurrence),
        openUrl,
      }),
    deepLink: { kind: "task", id: task.id },
    closesForEveryone: true,
    isPressable: true,
    snoozeMs: task.when.time === null ? daySnoozeMs : snoozeMs,
    isSkippedWhenLate: true,
  };
}

// A Completed single Task and an Archived Pet's Tasks remind of nothing.
function isSilent({ task, series }: RemindingTask): boolean {
  return series.isCompleted(null) || (task.pet?.archivedAt ?? null) !== null;
}

async function loadTaskSources(
  dependencies: ReminderDependencies,
  { holder, isKept }: { holder: SourceHolder; isKept: (reminding: RemindingTask) => boolean },
): Promise<Source[]> {
  const reminding = await dependencies.tasks.reminding(holder.familyId, holder.id);

  if (reminding === undefined || !isKept(reminding)) {
    return [];
  }

  const { task } = reminding;
  const chatLink = await dependencies.appLinks.chatLink();
  const openUrl = await dependencies.appLinks.appLink({ kind: "task", id: task.id });

  return task.reminderOffsets.map((offset) =>
    taskSource(dependencies, { reminding, sourcing: { offset, chatLink, openUrl } }),
  );
}

// Each offset of a Task is a source of its own with rows of its own; a Pet-linked Task offers to
// record a Care Entry.
export async function taskSources(
  dependencies: ReminderDependencies,
  holder: SourceHolder,
): Promise<Source[]> {
  return loadTaskSources(dependencies, { holder, isKept: (reminding) => !isSilent(reminding) });
}

// The sources a just Completed Occurrence closes, even when completing it silenced them.
export async function taskSourcesToClose(
  dependencies: ReminderDependencies,
  holder: SourceHolder,
): Promise<Source[]> {
  return loadTaskSources(dependencies, { holder, isKept: () => true });
}
