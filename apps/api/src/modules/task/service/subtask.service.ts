import { uuidv7, type SubtaskChange } from "@family-hub/contract";

import type { Membership } from "@/modules/auth";

import type { TaskTree } from "../task.repo.ts";
import type { SubtaskTarget, TaskDependencies, TaskRefusal, TaskResult } from "../task.types.ts";
import { currentTask, hasSubtask, visibleTree } from "./access.service.ts";
import { notifyAssignees } from "./assignment.service.ts";
import { settle } from "./completion.service.ts";

// A Subtask's Assignees follow its Task: of a Private one, only the owner.
async function refusalOf(
  { tasks }: TaskDependencies,
  membership: Membership,
  { tree: { root }, change }: { tree: TaskTree; change: SubtaskChange },
): Promise<TaskRefusal | undefined> {
  const ownerId = root.row.ownerMemberId ?? membership.member.id;
  const isAllowed =
    root.row.visibility === "private"
      ? change.assigneeIds.every((id) => id === ownerId)
      : await tasks.areMembers(membership.family.id, change.assigneeIds);

  return isAllowed ? undefined : "assignee-not-allowed";
}

type SubtaskSaving = SubtaskTarget & { change: SubtaskChange; isNew: boolean };

async function saveSubtask(
  dependencies: TaskDependencies,
  membership: Membership,
  { taskId, subtaskId, change, isNew }: SubtaskSaving,
): Promise<void> {
  const now = dependencies.clock.now();

  await dependencies.tasks.save({
    row: {
      id: subtaskId,
      familyId: membership.family.id,
      parentId: taskId,
      title: change.title,
      date: change.date,
      createdAt: now,
      createdBy: membership.member.id,
      updatedAt: now,
    },
    isNew,
    assigneeIds: change.assigneeIds,
    recipientIds: [],
  });
}

// A weekly chore would need its checklist reset, so a recurring Task has no Subtasks.
export async function addSubtask(
  dependencies: TaskDependencies,
  membership: Membership,
  { taskId, change }: { taskId: string; change: SubtaskChange },
): Promise<TaskResult> {
  const tree = await visibleTree(dependencies, membership, taskId);

  if (!tree) {
    return { status: "not-found" };
  }

  if (tree.root.row.frequency !== null) {
    return { status: "subtasks-not-allowed" };
  }

  const refusal = await refusalOf(dependencies, membership, { tree, change });

  if (refusal !== undefined) {
    return { status: refusal };
  }

  const subtaskId = uuidv7(dependencies.clock.now());

  await saveSubtask(dependencies, membership, { taskId, subtaskId, change, isNew: true });
  await settle(dependencies, membership, taskId);
  await notifyAssignees(dependencies, membership, {
    taskId,
    title: change.title,
    date: change.date,
    assigneeIds: change.assigneeIds,
    previousAssigneeIds: [],
  });

  return currentTask(dependencies, membership, taskId);
}

export async function updateSubtask(
  dependencies: TaskDependencies,
  membership: Membership,
  { taskId, subtaskId, change }: SubtaskTarget & { change: SubtaskChange },
): Promise<TaskResult> {
  const tree = await visibleTree(dependencies, membership, taskId);

  if (!hasSubtask(tree, subtaskId)) {
    return { status: "not-found" };
  }

  const refusal = await refusalOf(dependencies, membership, { tree, change });

  if (refusal !== undefined) {
    return { status: refusal };
  }

  const subtask = tree.subtasks.find(({ row }) => row.id === subtaskId);

  await saveSubtask(dependencies, membership, { taskId, subtaskId, change, isNew: false });
  await notifyAssignees(dependencies, membership, {
    taskId,
    title: change.title,
    date: change.date,
    assigneeIds: change.assigneeIds,
    previousAssigneeIds: subtask?.assignees.map(({ id }) => id) ?? [],
  });

  return currentTask(dependencies, membership, taskId);
}

// Removing a step is editing the Task, so any Member who sees it may do it.
export async function removeSubtask(
  dependencies: TaskDependencies,
  membership: Membership,
  { taskId, subtaskId }: SubtaskTarget,
): Promise<TaskResult> {
  const tree = await visibleTree(dependencies, membership, taskId);

  if (!hasSubtask(tree, subtaskId)) {
    return { status: "not-found" };
  }

  await dependencies.tasks.delete(membership.family.id, subtaskId);
  await settle(dependencies, membership, taskId);

  return currentTask(dependencies, membership, taskId);
}
