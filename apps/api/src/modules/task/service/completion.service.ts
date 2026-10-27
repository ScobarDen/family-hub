import type { Membership } from "@/common/auth";

import { isAllDone, isOccurrenceOf, occurrenceKey } from "../task.lib.ts";
import type { OccurrenceOf, SubtaskTarget, TaskDependencies, TaskResult } from "../task.types.ts";
import { currentTask, hasSubtask, visibleTree } from "./access.service.ts";

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

  if (!isOccurrenceOf(tree.root.row, occurrence)) {
    return { status: "not-an-occurrence" };
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

  if (!isOccurrenceOf(tree.root.row, occurrence)) {
    return { status: "not-an-occurrence" };
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

  if (tree.root.row.frequency === null || !isOccurrenceOf(tree.root.row, date)) {
    return { status: "not-an-occurrence" };
  }

  await dependencies.tasks.update(membership.family.id, taskId, {
    skippedDates: [...new Set([...tree.root.row.skippedDates, date])].toSorted(),
    updatedAt: dependencies.clock.now(),
  });

  return currentTask(dependencies, membership, taskId);
}

async function hasVisibleSubtask(
  dependencies: TaskDependencies,
  membership: Membership,
  { taskId, subtaskId }: SubtaskTarget,
): Promise<boolean> {
  return hasSubtask(await visibleTree(dependencies, membership, taskId), subtaskId);
}

export async function completeSubtask(
  dependencies: TaskDependencies,
  membership: Membership,
  target: SubtaskTarget,
): Promise<TaskResult> {
  if (!(await hasVisibleSubtask(dependencies, membership, target))) {
    return { status: "not-found" };
  }

  await dependencies.tasks.complete({
    familyId: membership.family.id,
    taskIds: [target.subtaskId],
    occurrence: "",
    memberId: membership.member.id,
    now: dependencies.clock.now(),
  });
  await settle(dependencies, membership, target.taskId);

  return currentTask(dependencies, membership, target.taskId);
}

export async function reopenSubtask(
  dependencies: TaskDependencies,
  membership: Membership,
  target: SubtaskTarget,
): Promise<TaskResult> {
  if (!(await hasVisibleSubtask(dependencies, membership, target))) {
    return { status: "not-found" };
  }

  await dependencies.tasks.reopen({
    familyId: membership.family.id,
    taskId: target.subtaskId,
    occurrence: "",
  });
  await settle(dependencies, membership, target.taskId);

  return currentTask(dependencies, membership, target.taskId);
}
