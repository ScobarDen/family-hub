import type { RemindingTask } from "@/modules/task";

import { holderIdOf } from "../lib/reminder.lib.ts";
import { taskSource } from "../lib/task-kind.lib.ts";
import type { ReminderDependencies, ReminderSource, SourceHolder } from "../reminder.types.ts";

type Loading = { holder: SourceHolder; isKept: (reminding: RemindingTask) => boolean };

// A Completed single Task and an Archived Pet's Tasks remind of nothing.
function isSilent({ task, series }: RemindingTask): boolean {
  return series.isCompleted(null) || (task.pet?.archivedAt ?? null) !== null;
}

async function loadTaskSources(
  dependencies: ReminderDependencies,
  { holder, isKept }: Loading,
): Promise<ReminderSource[]> {
  const reminding = await dependencies.tasks.reminding(holder.familyId, holder.id);

  if (reminding === undefined || !isKept(reminding)) {
    return [];
  }

  const chatLink = await dependencies.appLinks.chatLink();
  const openUrl = await dependencies.appLinks.appLink({ kind: "task", id: reminding.task.id });

  return reminding.task.reminderOffsets.map((offset) =>
    taskSource(reminding, { offset, chatLink, openUrl }),
  );
}

export async function taskSources(
  dependencies: ReminderDependencies,
  holder: SourceHolder,
): Promise<ReminderSource[]> {
  return loadTaskSources(dependencies, { holder, isKept: (reminding) => !isSilent(reminding) });
}

// The sources a just Completed Occurrence closes, even when completing it silenced them.
export async function taskSourcesToClose(
  dependencies: ReminderDependencies,
  holder: SourceHolder,
): Promise<ReminderSource[]> {
  return loadTaskSources(dependencies, { holder, isKept: () => true });
}

export async function taskSourceOf(
  dependencies: ReminderDependencies,
  { familyId, sourceId }: { familyId: string; sourceId: string },
): Promise<ReminderSource | undefined> {
  const sources = await taskSources(dependencies, { familyId, id: holderIdOf(sourceId) });

  return sources.find(({ schedule }) => schedule.sourceId === sourceId);
}
