import type { ParsedTaskChange, SubtaskChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import { bindFirst } from "@/common/bind";

import type { OccurrenceOf, SubtaskTarget, TaskDependencies } from "../task.types.ts";
import { complete, completeSubtask, reopen, reopenSubtask, skip } from "./completion.service.ts";
import { followUp, type FollowUp } from "./follow-up.service.ts";
import { addSubtask, removeSubtask, updateSubtask } from "./subtask.service.ts";
import { create, list, remove, update } from "./task-root.service.ts";

function scheduling({ schedule }: TaskDependencies) {
  return async function rescheduled<Result extends { status: string }>(
    { family }: Membership,
    { taskId, result }: { taskId: string; result: Result },
  ): Promise<Result> {
    if (result.status === "ok" || result.status === "deleted") {
      await schedule.sourceChanged(family.id, { kind: "task", id: taskId });
    }

    return result;
  };
}

function subtaskCommands(dependencies: TaskDependencies) {
  const rescheduled = scheduling(dependencies);

  return {
    addSubtask: async (membership: Membership, taskId: string, change: SubtaskChange) =>
      rescheduled(membership, {
        taskId,
        result: await addSubtask(dependencies, membership, { taskId, change }),
      }),
    updateSubtask: async (membership: Membership, target: SubtaskTarget, change: SubtaskChange) =>
      rescheduled(membership, {
        taskId: target.taskId,
        result: await updateSubtask(dependencies, membership, { ...target, change }),
      }),
    removeSubtask: async (membership: Membership, target: SubtaskTarget) =>
      rescheduled(membership, {
        taskId: target.taskId,
        result: await removeSubtask(dependencies, membership, target),
      }),
    completeSubtask: async (membership: Membership, target: SubtaskTarget) =>
      rescheduled(membership, {
        taskId: target.taskId,
        result: await completeSubtask(dependencies, membership, target),
      }),
    reopenSubtask: async (membership: Membership, target: SubtaskTarget) =>
      rescheduled(membership, {
        taskId: target.taskId,
        result: await reopenSubtask(dependencies, membership, target),
      }),
  };
}

function occurrenceCommands(dependencies: TaskDependencies) {
  const rescheduled = scheduling(dependencies);

  return {
    complete: async (membership: Membership, target: OccurrenceOf) =>
      rescheduled(membership, {
        taskId: target.taskId,
        result: await complete(dependencies, membership, target),
      }),
    reopen: async (membership: Membership, target: OccurrenceOf) =>
      rescheduled(membership, {
        taskId: target.taskId,
        result: await reopen(dependencies, membership, target),
      }),
    skip: async (membership: Membership, taskId: string, date: string) =>
      rescheduled(membership, {
        taskId,
        result: await skip(dependencies, membership, { taskId, date }),
      }),
  };
}

export function createTaskService(dependencies: TaskDependencies) {
  const rescheduled = scheduling(dependencies);

  return {
    ...bindFirst(dependencies, { list }),
    create: async (membership: Membership, change: ParsedTaskChange) => {
      const result = await create(dependencies, membership, change);

      return result.status === "ok"
        ? rescheduled(membership, { taskId: result.task.id, result })
        : result;
    },
    update: async (membership: Membership, taskId: string, change: ParsedTaskChange) =>
      rescheduled(membership, {
        taskId,
        result: await update(dependencies, membership, { taskId, change }),
      }),
    remove: async (membership: Membership, taskId: string) =>
      rescheduled(membership, { taskId, result: await remove(dependencies, membership, taskId) }),
    followUp: async (membership: Membership, request: FollowUp) => {
      const result = await followUp(dependencies, membership, request);

      return result.status === "ok"
        ? rescheduled(membership, { taskId: result.task.id, result })
        : result;
    },
    ...occurrenceCommands(dependencies),
    ...subtaskCommands(dependencies),
  };
}

export type TaskService = ReturnType<typeof createTaskService>;
