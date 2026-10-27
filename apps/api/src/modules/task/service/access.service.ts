import { taskAlbumPreview, type Task, type TaskAlbum } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import { isHiddenFrom } from "@/common/visibility";

import { toTask } from "../task.lib.ts";
import type { TaskTree } from "../task.repo.ts";
import type { TaskDependencies, TaskResult } from "../task.types.ts";

export async function visibleTree(
  { tasks }: TaskDependencies,
  { family, member }: Membership,
  taskId: string,
): Promise<TaskTree | undefined> {
  const tree = await tasks.findTree(family.id, taskId);
  const isHidden = tree !== undefined && isHiddenFrom(tree.root.row, member.id);

  return isHidden ? undefined : tree;
}

export function hasSubtask(tree: TaskTree | undefined, subtaskId: string): tree is TaskTree {
  return tree?.subtasks.some(({ row }) => row.id === subtaskId) === true;
}

// The strip shows the Album's first photos by when they were taken.
async function albumOf(
  { tasks, links }: TaskDependencies,
  { family, member, isFamilyOwner }: Membership,
  albumId: string | null,
): Promise<TaskAlbum | null> {
  const row = albumId === null ? undefined : await tasks.albumOf({ familyId: family.id, albumId });

  if (!row) {
    return null;
  }

  const sorted = row.photos.toSorted(
    (left, right) => (left.takenAt ?? left.createdAt) - (right.takenAt ?? right.createdAt),
  );
  const viewer = { memberId: member.id, isFamilyOwner };

  return {
    id: row.id,
    title: row.title,
    photos: await Promise.all(
      sorted.slice(0, taskAlbumPreview).map(async (photo) => links.photoOf(photo, viewer)),
    ),
    photoCount: sorted.length,
  };
}

async function petOf(
  { tasks, links }: TaskDependencies,
  { family }: Membership,
  petId: string | null,
): Promise<Task["pet"]> {
  const pet = petId === null ? undefined : await tasks.petOf(family.id, petId);

  return pet === undefined
    ? null
    : { id: pet.id, name: pet.name, picture: await links.thumbOf(pet.avatarPhotoId) };
}

export async function taskOf(
  dependencies: TaskDependencies,
  membership: Membership,
  tree: TaskTree,
): Promise<Task> {
  const [album, pet] = await Promise.all([
    albumOf(dependencies, membership, tree.root.row.albumId),
    petOf(dependencies, membership, tree.root.row.petId),
  ]);

  return toTask(tree, { memberId: membership.member.id, album, pet });
}

export async function currentTask(
  dependencies: TaskDependencies,
  membership: Membership,
  taskId: string,
): Promise<TaskResult> {
  const tree = await visibleTree(dependencies, membership, taskId);

  return tree
    ? { status: "ok", task: await taskOf(dependencies, membership, tree) }
    : { status: "not-found" };
}
