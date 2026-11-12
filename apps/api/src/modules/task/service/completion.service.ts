import type { Membership } from "@/modules/auth";

import { taskSeries } from "../lib/series.lib.ts";
import { isAllDone, occurrenceDateOf, occurrenceKey } from "../lib/task.lib.ts";
import type { CompletionRow, TaskRow } from "../task.repo.ts";
import type { OccurrenceOf, SubtaskTarget, TaskDependencies, TaskResult } from "../task.types.ts";
import { currentTask, hasSubtask, visibleTree } from "./access.service.ts";

function completerOf(completion: CompletionRow | undefined) {
  return completion?.byId === undefined || completion.byId === null || completion.by === null
    ? undefined
    : { id: completion.byId, name: completion.by };
}

// Named after the Member the completion records, so completing it again never renames who did it;
// an Occurrence no Reminder can name still reschedules the Task.
async function announceCompleted(
  { tasks, schedule }: TaskDependencies,
  familyId: string,
  { taskId, occurrence }: OccurrenceOf,
): Promise<void> {
  const tree = await tasks.findTree(familyId, taskId);
  const row = tree?.root.row;
  const date = row && occurrenceDateOf(row, occurrence);
  const by = completerOf(
    row &&
      tree?.root.completions.find((found) => found.occurrence === occurrenceKey(row, occurrence)),
  );

  await (date === undefined || date === null || by === undefined
    ? schedule.sourceChanged(familyId, { kind: "task", id: taskId })
    : schedule.occurrenceCompleted(familyId, { taskId, occurrence: date, by }));
}

async function announceReopened(
  { schedule }: TaskDependencies,
  familyId: string,
  { row, occurrence }: { row: TaskRow; occurrence: string | null },
): Promise<void> {
  const date = occurrenceDateOf(row, occurrence);

  await (date === null
    ? schedule.sourceChanged(familyId, { kind: "task", id: row.id })
    : schedule.occurrenceReopened(familyId, { taskId: row.id, occurrence: date }));
}

// The Task follows its Subtasks: Completed when the last one is, open again when any one is.
export async function settle(
  dependencies: TaskDependencies,
  { family, member }: Membership,
  taskId: string,
): Promise<void> {
  const { tasks, clock } = dependencies;
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
    await announceCompleted(dependencies, family.id, { taskId, occurrence: null });
  } else if (!isDone && isRootDone) {
    await tasks.reopen({ familyId: family.id, taskId, occurrence: "" });
    await announceReopened(dependencies, family.id, { row: tree.root.row, occurrence: null });
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

  if (!taskSeries(tree.root).isOccurrence(occurrence)) {
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
  await announceCompleted(dependencies, membership.family.id, { taskId, occurrence });

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

  if (!taskSeries(tree.root).isOccurrence(occurrence)) {
    return { status: "not-an-occurrence" };
  }

  await dependencies.tasks.reopen({
    familyId: membership.family.id,
    taskId,
    occurrence: occurrenceKey(tree.root.row, occurrence),
  });
  await announceReopened(dependencies, membership.family.id, { row: tree.root.row, occurrence });

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

  const { row } = tree.root;

  if (row.skippedDates.includes(date)) {
    return currentTask(dependencies, membership, taskId);
  }

  if (row.frequency === null || !taskSeries(tree.root).isOccurrence(date)) {
    return { status: "not-an-occurrence" };
  }

  await dependencies.tasks.update(membership.family.id, taskId, {
    skippedDates: [...row.skippedDates, date].toSorted(),
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
