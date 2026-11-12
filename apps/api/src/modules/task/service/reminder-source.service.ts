import { taskSeries } from "../lib/series.lib.ts";
import { whenOf } from "../lib/task.lib.ts";
import type { TaskRepo } from "../task.repo.ts";
import type { RemindingTask } from "../task.types.ts";

// A Task without a date has no Occurrences, so nothing to remind of.
async function reminding(
  tasks: TaskRepo,
  { familyId, taskId }: { familyId: string; taskId: string },
): Promise<RemindingTask | undefined> {
  const tree = await tasks.findTree(familyId, taskId);

  if (tree === undefined) {
    return undefined;
  }

  const when = whenOf(tree.root.row);

  if (when === null) {
    return undefined;
  }

  const { row } = tree.root;
  const series = taskSeries(tree.root);
  const pet = row.petId === null ? undefined : await tasks.petOf(familyId, row.petId);

  return {
    task: {
      id: row.id,
      title: row.title,
      when,
      petId: row.petId,
      reminderOffsets: row.reminderOffsets,
      pet: pet && { name: pet.name, archivedAt: pet.archivedAt },
    },
    series,
    recipientIds: series.recipients(await tasks.memberIdsOf(familyId)),
  };
}

export function createTaskReminding({ tasks }: { tasks: TaskRepo }) {
  return {
    reminding: async (familyId: string, taskId: string) => reminding(tasks, { familyId, taskId }),
  };
}
