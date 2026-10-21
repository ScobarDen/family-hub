import { uuidv7, type Plan, type PlanChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import type { PlanDependencies, PlanRefusal, PlanResult } from "../plan.types.ts";
import { currentPlan, isAssigneeAllowed, visibleTree } from "./access.service.ts";
import { notifyAssignee } from "./assignment.service.ts";
import { planOf } from "./plan-album.service.ts";

function byDueDate(left: Plan, right: Plan): number {
  if (left.dueDate === right.dueDate) {
    return 0;
  }

  if (left.dueDate === null || right.dueDate === null) {
    return left.dueDate === null ? 1 : -1;
  }

  return left.dueDate < right.dueDate ? -1 : 1;
}

async function refusalOf(
  dependencies: PlanDependencies,
  membership: Membership,
  { change, ownerId }: { change: PlanChange; ownerId: string },
): Promise<PlanRefusal | undefined> {
  if (!(await isAssigneeAllowed(dependencies, membership, { ...change, ownerId }))) {
    return "assignee-not-allowed";
  }

  const isPetMissing =
    change.petId !== null && !(await dependencies.plans.hasPet(membership.family.id, change.petId));
  const isAlbumMissing =
    change.albumId !== null &&
    (await dependencies.plans.albumOf({
      familyId: membership.family.id,
      albumId: change.albumId,
    })) === undefined;

  if (isPetMissing) {
    return "pet-not-found";
  }

  return isAlbumMissing ? "album-not-found" : undefined;
}

export async function list(
  dependencies: PlanDependencies,
  membership: Membership,
): Promise<Plan[]> {
  const trees = await dependencies.plans.listVisible(membership.family.id, membership.member.id);
  const all = await Promise.all(trees.map(async (tree) => planOf(dependencies, membership, tree)));

  return all.toSorted(byDueDate);
}

export async function create(
  dependencies: PlanDependencies,
  membership: Membership,
  change: PlanChange,
): Promise<PlanResult> {
  const ownerId = membership.member.id;

  const refusal = await refusalOf(dependencies, membership, { change, ownerId });

  if (refusal !== undefined) {
    return { status: refusal };
  }

  const now = dependencies.clock.now();
  const id = uuidv7(now);

  await dependencies.plans.add({
    id,
    familyId: membership.family.id,
    ownerMemberId: ownerId,
    visibility: change.visibility,
    title: change.title,
    note: change.note,
    dueDate: change.dueDate,
    reminder: change.reminder,
    assigneeMemberId: change.assigneeId,
    petId: change.petId,
    albumId: change.albumId,
    createdAt: now,
    createdBy: ownerId,
    updatedAt: now,
  });
  await notifyAssignee(dependencies, membership, {
    planId: id,
    title: change.title,
    dueDate: change.dueDate,
    assigneeId: change.assigneeId,
    previousAssigneeId: null,
  });

  return currentPlan(dependencies, membership, id);
}

export async function update(
  dependencies: PlanDependencies,
  membership: Membership,
  { planId, change }: { planId: string; change: PlanChange },
): Promise<PlanResult> {
  const tree = await visibleTree(dependencies, membership, planId);

  if (!tree) {
    return { status: "not-found" };
  }

  // Others may already have seen and contributed to a Shared Plan, so it never turns Private.
  if (tree.root.visibility === "shared" && change.visibility === "private") {
    return { status: "visibility-one-way" };
  }

  const ownerId = tree.root.ownerMemberId ?? membership.member.id;

  const refusal = await refusalOf(dependencies, membership, { change, ownerId });

  if (refusal !== undefined) {
    return { status: refusal };
  }

  await dependencies.plans.update(membership.family.id, planId, {
    title: change.title,
    note: change.note,
    dueDate: change.dueDate,
    reminder: change.reminder,
    assigneeMemberId: change.assigneeId,
    visibility: change.visibility,
    petId: change.petId,
    albumId: change.albumId,
    updatedAt: dependencies.clock.now(),
  });
  await notifyAssignee(dependencies, membership, {
    planId,
    title: change.title,
    dueDate: change.dueDate,
    assigneeId: change.assigneeId,
    previousAssigneeId: tree.root.assigneeMemberId,
  });

  return currentPlan(dependencies, membership, planId);
}

export type DeleteResult =
  | { status: "deleted" }
  | { status: "not-found" }
  | { status: "not-owner" };

export async function remove(
  dependencies: PlanDependencies,
  membership: Membership,
  planId: string,
): Promise<DeleteResult> {
  const tree = await visibleTree(dependencies, membership, planId);

  if (!tree) {
    return { status: "not-found" };
  }

  if (tree.root.ownerMemberId !== membership.member.id) {
    return { status: "not-owner" };
  }

  await dependencies.plans.delete(membership.family.id, planId);

  return { status: "deleted" };
}
