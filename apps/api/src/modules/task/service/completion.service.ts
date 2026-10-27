import type { Membership } from "@/common/auth";

import { isAllDone, occurrenceKey } from "../task.lib.ts";
import type { TaskDependencies, TaskResult } from "../task.types.ts";
import { currentTask, hasSubtask, visibleTree } from "./access.service.ts";

type OccurrenceOf = { taskId: string; occurrence: string | null };

type SubtaskTarget = { taskId: string; subtaskId: string };

// The Task follows its Subtasks: Completed when the last one is, open again when any one is.
export async function settle(
  { tasks, clock }: TaskDependencies,
  { family, member }: Membership,
  taskId: string,
): Promise<void> {
  const tree = await tasks.findTree(family.id, taskId);

  if (!tree || tree.subtasks.length === 0) {
    return;
  }

  const isDone = isAllDone(tree.subtasks);
  const isRootDone = tree.root.completions.length > 0;

  if (isDone && !isRootDone) {
    await tasks.complete({
      familyId: family.id,
      taskIds: [taskId],
      occurrence: "",
      memberId: member.id,
      now: clock.now(),
    });
  } else if (!isDone && isRootDone) {
    await tasks.reopen({ familyId: family.id, taskId, occurrence: "" });
  }
}

// Any Member who sees the Task completes an Occurrence for all its Assignees; completing a Task
// by hand completes its open Subtasks with it.
export async function complete(
  dependencies: TaskDependencies,
  membership: Membership,
  { taskId, occurrence }: OccurrenceOf,
): Promise<TaskResult> {
  const tree = await visibleTree(dependencies, membership, taskId);

  if (!tree) {
    return { status: "not-found" };
  }

  const open = tree.subtasks.filter(({ completions }) => completions.length === 0);
  const now = dependencies.clock.now();
  const completing = { familyId: membership.family.id, memberId: membership.member.id, now };

  await dependencies.tasks.complete({
    ...completing,
    taskIds: open.map(({ row }) => row.id),
    occurrence: "",
  });
  await dependencies.tasks.complete({
    ...completing,
    taskIds: [taskId],
    occurrence: occurrenceKey(tree.root.row, occurrence),
  });

  return currentTask(dependencies, membership, taskId);
}

export async function reopen(
  dependencies: TaskDependencies,
  membership: Membership,
  { taskId, occurrence }: OccurrenceOf,
): Promise<TaskResult> {
  const tree = await visibleTree(dependencies, membership, taskId);

  if (!tree) {
    return { status: "not-found" };
  }

  await dependencies.tasks.reopen({
    familyId: membership.family.id,
    taskId,
    occurrence: occurrenceKey(tree.root.row, occurrence),
  });

  return currentTask(dependencies, membership, taskId);
}

export async function skip(
  dependencies: TaskDependencies,
  membership: Membership,
  { taskId, date }: { taskId: string; date: string },
): Promise<TaskResult> {
  const tree = await visibleTree(dependencies, membership, taskId);

  if (!tree) {
    return { status: "not-found" };
  }

  await dependencies.tasks.update(membership.family.id, taskId, {
    skippedDates: [...new Set([...tree.root.row.skippedDates, date])].toSorted(),
    updatedAt: dependencies.clock.now(),
  });

  return currentTask(dependencies, membership, taskId);
}

export async function markSubtask(
  dependencies: TaskDependencies,
  membership: Membership,
  { taskId, subtaskId, isDone }: SubtaskTarget & { isDone: boolean },
): Promise<TaskResult> {
  const tree = await visibleTree(dependencies, membership, taskId);

  if (!hasSubtask(tree, subtaskId)) {
    return { status: "not-found" };
  }

  const familyId = membership.family.id;

  await (isDone
    ? dependencies.tasks.complete({
        familyId,
        taskIds: [subtaskId],
        occurrence: "",
        memberId: membership.member.id,
        now: dependencies.clock.now(),
      })
    : dependencies.tasks.reopen({ familyId, taskId: subtaskId, occurrence: "" }));
  await settle(dependencies, membership, taskId);

  return currentTask(dependencies, membership, taskId);
}
