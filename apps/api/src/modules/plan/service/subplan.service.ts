import { uuidv7, type SubplanChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import type { PlanTree } from "../plan.repo.ts";
import type { PlanDependencies, PlanResult } from "../plan.types.ts";
import { currentPlan, hasSubplan, isAssigneeAllowed, visibleTree } from "./access.service.ts";
import { notifyAssignee } from "./assignment.service.ts";
import { settle } from "./completion.service.ts";

type SubplanTarget = { planId: string; subplanId: string };

async function isAllowedFor(
  dependencies: PlanDependencies,
  membership: Membership,
  { tree: { root }, assigneeId }: { tree: PlanTree; assigneeId: string | null },
): Promise<boolean> {
  return isAssigneeAllowed(dependencies, membership, {
    assigneeId,
    visibility: root.visibility ?? "shared",
    ownerId: root.ownerMemberId ?? membership.member.id,
  });
}

export async function addSubplan(
  dependencies: PlanDependencies,
  membership: Membership,
  { planId, change }: { planId: string; change: SubplanChange },
): Promise<PlanResult> {
  const tree = await visibleTree(dependencies, membership, planId);

  if (!tree) {
    return { status: "not-found" };
  }

  if (!(await isAllowedFor(dependencies, membership, { tree, assigneeId: change.assigneeId }))) {
    return { status: "assignee-not-allowed" };
  }

  const now = dependencies.clock.now();

  await dependencies.plans.add({
    id: uuidv7(now),
    familyId: membership.family.id,
    parentId: planId,
    title: change.title,
    dueDate: change.dueDate,
    assigneeMemberId: change.assigneeId,
    createdAt: now,
    createdBy: membership.member.id,
    updatedAt: now,
  });
  await settle(dependencies, membership, planId);
  await notifyAssignee(dependencies, membership, {
    planId,
    title: change.title,
    dueDate: change.dueDate,
    assigneeId: change.assigneeId,
    previousAssigneeId: null,
  });

  return currentPlan(dependencies, membership, planId);
}

export async function updateSubplan(
  dependencies: PlanDependencies,
  membership: Membership,
  { planId, subplanId, change }: SubplanTarget & { change: SubplanChange },
): Promise<PlanResult> {
  const tree = await visibleTree(dependencies, membership, planId);

  if (!hasSubplan(tree, subplanId)) {
    return { status: "not-found" };
  }

  if (!(await isAllowedFor(dependencies, membership, { tree, assigneeId: change.assigneeId }))) {
    return { status: "assignee-not-allowed" };
  }

  await dependencies.plans.update(membership.family.id, subplanId, {
    title: change.title,
    dueDate: change.dueDate,
    assigneeMemberId: change.assigneeId,
    updatedAt: dependencies.clock.now(),
  });
  await notifyAssignee(dependencies, membership, {
    planId,
    title: change.title,
    dueDate: change.dueDate,
    assigneeId: change.assigneeId,
    previousAssigneeId: tree.subplans.find(({ id }) => id === subplanId)?.assigneeMemberId ?? null,
  });

  return currentPlan(dependencies, membership, planId);
}

// Removing a step is editing the Plan, so any Member who sees it may do it.
export async function removeSubplan(
  dependencies: PlanDependencies,
  membership: Membership,
  { planId, subplanId }: SubplanTarget,
): Promise<PlanResult> {
  const tree = await visibleTree(dependencies, membership, planId);

  if (!hasSubplan(tree, subplanId)) {
    return { status: "not-found" };
  }

  await dependencies.plans.delete(membership.family.id, subplanId);
  await settle(dependencies, membership, planId);

  return currentPlan(dependencies, membership, planId);
}
