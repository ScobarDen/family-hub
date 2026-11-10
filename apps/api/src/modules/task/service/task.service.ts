import type { ParsedTaskChange, SubtaskChange } from "@family-hub/contract";

import { bindFirst } from "@/common/bind.lib.ts";
import type { Membership } from "@/modules/auth";

import type {
  DeleteResult,
  OccurrenceOf,
  SubtaskTarget,
  TaskDependencies,
  TaskResult,
} from "../task.types.ts";
import { complete, completeSubtask, reopen, reopenSubtask, skip } from "./completion.service.ts";
import { followUp, type FollowUp } from "./follow-up.service.ts";
import { addSubtask, removeSubtask, updateSubtask } from "./subtask.service.ts";
import { create, list, remove, update } from "./task-root.service.ts";

// A Pet's card lists its Tasks, so a Task linked to a Pet before or after the write changes it too.
function afterWriteOf({ schedule, live }: TaskDependencies) {
  return async function afterWrite<Result extends TaskResult | DeleteResult>(
    { family }: Membership,
    {
      taskId,
      result,
      wasLinkedToPet = false,
    }: { taskId: string; result: Result; wasLinkedToPet?: boolean },
  ): Promise<Result> {
    if (result.status !== "ok" && result.status !== "deleted") {
      return result;
    }

    await schedule.sourceChanged(family.id, { kind: "task", id: taskId });

    const touchesPet = wasLinkedToPet || ("task" in result && result.task.pet !== null);

    live.changed(family.id, touchesPet ? ["tasks", "pet"] : ["tasks"]);

    return result;
  };
}

async function isLinkedToPet(
  { tasks }: TaskDependencies,
  { family }: Membership,
  taskId: string,
): Promise<boolean> {
  const tree = await tasks.findTree(family.id, taskId);

  return tree !== undefined && tree.root.row.petId !== null;
}

function subtaskCommands(dependencies: TaskDependencies) {
  const afterWrite = afterWriteOf(dependencies);

  return {
    addSubtask: async (membership: Membership, taskId: string, change: SubtaskChange) =>
      afterWrite(membership, {
        taskId,
        result: await addSubtask(dependencies, membership, { taskId, change }),
      }),
    updateSubtask: async (membership: Membership, target: SubtaskTarget, change: SubtaskChange) =>
      afterWrite(membership, {
        taskId: target.taskId,
        result: await updateSubtask(dependencies, membership, { ...target, change }),
      }),
    removeSubtask: async (membership: Membership, target: SubtaskTarget) =>
      afterWrite(membership, {
        taskId: target.taskId,
        result: await removeSubtask(dependencies, membership, target),
      }),
    completeSubtask: async (membership: Membership, target: SubtaskTarget) =>
      afterWrite(membership, {
        taskId: target.taskId,
        result: await completeSubtask(dependencies, membership, target),
      }),
    reopenSubtask: async (membership: Membership, target: SubtaskTarget) =>
      afterWrite(membership, {
        taskId: target.taskId,
        result: await reopenSubtask(dependencies, membership, target),
      }),
  };
}

function occurrenceCommands(dependencies: TaskDependencies) {
  const afterWrite = afterWriteOf(dependencies);

  return {
    complete: async (membership: Membership, target: OccurrenceOf) =>
      afterWrite(membership, {
        taskId: target.taskId,
        result: await complete(dependencies, membership, target),
      }),
    reopen: async (membership: Membership, target: OccurrenceOf) =>
      afterWrite(membership, {
        taskId: target.taskId,
        result: await reopen(dependencies, membership, target),
      }),
    skip: async (membership: Membership, taskId: string, date: string) =>
      afterWrite(membership, {
        taskId,
        result: await skip(dependencies, membership, { taskId, date }),
      }),
  };
}

export function createTaskService(dependencies: TaskDependencies) {
  const afterWrite = afterWriteOf(dependencies);

  return {
    ...bindFirst(dependencies, { list }),
    create: async (membership: Membership, change: ParsedTaskChange) => {
      const result = await create(dependencies, membership, change);

      return result.status === "ok"
        ? afterWrite(membership, { taskId: result.task.id, result })
        : result;
    },
    update: async (membership: Membership, taskId: string, change: ParsedTaskChange) => {
      const wasLinkedToPet = await isLinkedToPet(dependencies, membership, taskId);

      return afterWrite(membership, {
        taskId,
        result: await update(dependencies, membership, { taskId, change }),
        wasLinkedToPet,
      });
    },
    remove: async (membership: Membership, taskId: string) => {
      const wasLinkedToPet = await isLinkedToPet(dependencies, membership, taskId);

      return afterWrite(membership, {
        taskId,
        result: await remove(dependencies, membership, taskId),
        wasLinkedToPet,
      });
    },
    followUp: async (membership: Membership, request: FollowUp) => {
      const result = await followUp(dependencies, membership, request);

      return result.status === "ok"
        ? afterWrite(membership, { taskId: result.task.id, result })
        : result;
    },
    ...occurrenceCommands(dependencies),
    ...subtaskCommands(dependencies),
  };
}

export type TaskService = ReturnType<typeof createTaskService>;
