import { uuidv7, type ParsedTaskChange, type Task } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import { isTurnedPrivate } from "@/common/visibility";

import { columnsOf } from "../task.lib.ts";
import type { TaskTree } from "../task.repo.ts";
import type { DeleteResult, TaskDependencies, TaskRefusal, TaskResult } from "../task.types.ts";
import { currentTask, taskOf, visibleTree } from "./access.service.ts";
import { notifyAssignees } from "./assignment.service.ts";

type Checking = { change: ParsedTaskChange; ownerId: string; tree?: TaskTree };

// A Private Task's people could reveal the surprise, so they are its owner or nobody.
async function arePeopleAllowed(
  { tasks }: TaskDependencies,
  { family }: Membership,
  { change, ownerId }: Checking,
): Promise<TaskRefusal | undefined> {
  const recipientIds = Array.isArray(change.recipients) ? change.recipients : [];

  if (change.visibility === "private") {
    if (change.assigneeIds.some((id) => id !== ownerId)) {
      return "assignee-not-allowed";
    }

    return recipientIds.some((id) => id !== ownerId) ? "recipients-not-allowed" : undefined;
  }

  if (!(await tasks.areMembers(family.id, change.assigneeIds))) {
    return "assignee-not-allowed";
  }

  return (await tasks.areMembers(family.id, recipientIds)) ? undefined : "recipients-not-allowed";
}

async function linkRefusalOf(
  { tasks }: TaskDependencies,
  { family }: Membership,
  { petId, albumId }: ParsedTaskChange,
): Promise<TaskRefusal | undefined> {
  if (petId !== null && !(await tasks.petOf(family.id, petId))) {
    return "pet-not-found";
  }

  const isAlbumMissing =
    albumId !== null && (await tasks.albumOf({ familyId: family.id, albumId })) === undefined;

  return isAlbumMissing ? "album-not-found" : undefined;
}

async function refusalOf(
  dependencies: TaskDependencies,
  membership: Membership,
  checking: Checking,
): Promise<TaskRefusal | undefined> {
  const { change, tree } = checking;

  if (change.recurrence !== null && (tree?.subtasks.length ?? 0) > 0) {
    return "subtasks-not-allowed";
  }

  return (
    (await arePeopleAllowed(dependencies, membership, checking)) ??
    (await linkRefusalOf(dependencies, membership, change))
  );
}

// Dated Tasks come first, by date and time; those without a date keep their order of creation.
function byDate(left: Task, right: Task): number {
  const leftKey = left.when === null ? "~" : `${left.when.date} ${left.when.time ?? ""}`;
  const rightKey = right.when === null ? "~" : `${right.when.date} ${right.when.time ?? ""}`;

  return leftKey.localeCompare(rightKey);
}

export async function list(dependencies: TaskDependencies, membership: Membership) {
  const trees = await dependencies.tasks.listVisible(membership.family.id, membership.member.id);
  const all = await Promise.all(trees.map(async (tree) => taskOf(dependencies, membership, tree)));

  return all.toSorted(byDate);
}

type Saving = { taskId: string; ownerId: string; isNew: boolean; change: ParsedTaskChange };

async function save(
  dependencies: TaskDependencies,
  membership: Membership,
  { taskId, ownerId, isNew, change }: Saving,
): Promise<void> {
  const now = dependencies.clock.now();

  await dependencies.tasks.save({
    row: {
      id: taskId,
      familyId: membership.family.id,
      ownerMemberId: ownerId,
      ...columnsOf(change),
      createdAt: now,
      createdBy: membership.member.id,
      updatedAt: now,
    },
    isNew,
    assigneeIds: change.assigneeIds,
    recipientIds: Array.isArray(change.recipients) ? change.recipients : [],
  });
}

export async function create(
  dependencies: TaskDependencies,
  membership: Membership,
  change: ParsedTaskChange,
): Promise<TaskResult> {
  const ownerId = membership.member.id;
  const refusal = await refusalOf(dependencies, membership, { change, ownerId });

  if (refusal !== undefined) {
    return { status: refusal };
  }

  const taskId = uuidv7(dependencies.clock.now());

  await save(dependencies, membership, { taskId, ownerId, isNew: true, change });
  await notifyAssignees(dependencies, membership, {
    taskId,
    title: change.title,
    date: change.when?.date ?? null,
    assigneeIds: change.assigneeIds,
    previousAssigneeIds: [],
  });

  return currentTask(dependencies, membership, taskId);
}

// An edit applies to the whole series; single Occurrences are only ever skipped.
export async function update(
  dependencies: TaskDependencies,
  membership: Membership,
  { taskId, change }: { taskId: string; change: ParsedTaskChange },
): Promise<TaskResult> {
  const tree = await visibleTree(dependencies, membership, taskId);

  if (!tree) {
    return { status: "not-found" };
  }

  if (isTurnedPrivate(tree.root.row.visibility, change.visibility)) {
    return { status: "visibility-one-way" };
  }

  const ownerId = tree.root.row.ownerMemberId ?? membership.member.id;
  const refusal = await refusalOf(dependencies, membership, { change, ownerId, tree });

  if (refusal !== undefined) {
    return { status: refusal };
  }

  await save(dependencies, membership, { taskId, ownerId, isNew: false, change });
  await notifyAssignees(dependencies, membership, {
    taskId,
    title: change.title,
    date: change.when?.date ?? null,
    assigneeIds: change.assigneeIds,
    previousAssigneeIds: tree.root.assignees.map(({ id }) => id),
  });

  return currentTask(dependencies, membership, taskId);
}

export async function remove(
  dependencies: TaskDependencies,
  membership: Membership,
  taskId: string,
): Promise<DeleteResult> {
  const tree = await visibleTree(dependencies, membership, taskId);

  if (!tree) {
    return { status: "not-found" };
  }

  if (tree.root.row.ownerMemberId !== membership.member.id) {
    return { status: "not-owner" };
  }

  await dependencies.tasks.delete(membership.family.id, taskId);

  return { status: "deleted" };
}
