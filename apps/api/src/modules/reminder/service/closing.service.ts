import type { CompletedOccurrence, ReopenedOccurrence } from "@/modules/task";

import type { ReminderDependencies, ReminderSource } from "../reminder.types.ts";
import type { DispatchRow } from "../repo/dispatch.repo.ts";
import { editMessage, reminderOfRow } from "./recipient-reminder.service.ts";
import { sourceChanged } from "./schedule.service.ts";
import { kindsOf } from "./source.service.ts";
import { taskSourcesToClose } from "./task-source.service.ts";

type Closed = {
  rows: DispatchRow[];
  occurrence: string | null;
  by: { id: string; name: string };
  sourceOf: (row: DispatchRow) => ReminderSource | undefined;
};

export async function closeOccurrence(
  dependencies: ReminderDependencies,
  { rows, occurrence, by, sourceOf }: Closed,
): Promise<void> {
  const now = dependencies.clock.now();

  for (const row of rows) {
    const source = sourceOf(row);
    const reminder =
      source && (await reminderOfRow(dependencies, { row, source, occurrence, now }));
    const closing = reminder?.closed(by);

    if (closing !== undefined) {
      if (closing.edit !== undefined) {
        await editMessage(dependencies, closing.edit);
      }

      await dependencies.dispatch.update(row.familyId, row.id, closing.patch);
    }
  }
}

function rowsOfTask(dependencies: ReminderDependencies, familyId: string, taskId: string) {
  return dependencies.dispatch.ofHolder({ familyId, sources: kindsOf("task"), holderId: taskId });
}

// Every offset of the Task closes with it; its rows are read before rescheduling, which drops
// them once a single Task is Completed.
export async function occurrenceCompleted(
  dependencies: ReminderDependencies,
  familyId: string,
  { taskId, occurrence, by }: CompletedOccurrence,
): Promise<void> {
  const sources = await taskSourcesToClose(dependencies, { familyId, id: taskId });

  await closeOccurrence(dependencies, {
    rows: await rowsOfTask(dependencies, familyId, taskId),
    occurrence,
    by,
    sourceOf: (row) => sources.find(({ schedule }) => schedule.sourceId === row.sourceId),
  });
  await sourceChanged(dependencies, { familyId, kind: "task", id: taskId });
}

// The messages already rewritten stay as they are; only the mark that refuses a press goes.
export async function occurrenceReopened(
  dependencies: ReminderDependencies,
  familyId: string,
  { taskId, occurrence }: ReopenedOccurrence,
): Promise<void> {
  const now = dependencies.clock.now();

  for (const row of await rowsOfTask(dependencies, familyId, taskId)) {
    if (row.sentOccurrence === occurrence && row.doneAt !== null) {
      await dependencies.dispatch.update(familyId, row.id, {
        doneAt: null,
        doneBy: null,
        updatedAt: now,
      });
    }
  }

  await sourceChanged(dependencies, { familyId, kind: "task", id: taskId });
}
