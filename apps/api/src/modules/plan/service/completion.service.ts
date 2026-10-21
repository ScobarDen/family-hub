import type { Membership } from "@/common/auth";

import { isAllDone } from "../plan.lib.ts";
import type { PlanDependencies, PlanResult } from "../plan.types.ts";
import { currentPlan, hasSubplan, visibleTree } from "./access.service.ts";

type SubplanTarget = { planId: string; subplanId: string };

// The Plan follows its Subplans: done when the last one is, open again when any one is.
export async function settle(
  { plans, clock }: PlanDependencies,
  { family, member }: Membership,
  planId: string,
): Promise<void> {
  const tree = await plans.findTree(family.id, planId);

  if (!tree || tree.subplans.length === 0) {
    return;
  }

  const isDone = isAllDone(tree.subplans);
  const now = clock.now();

  if (isDone && tree.root.completedAt === null) {
    await plans.update(family.id, planId, {
      completedAt: now,
      completedBy: member.id,
      updatedAt: now,
    });
  } else if (!isDone && tree.root.completedAt !== null) {
    await plans.update(family.id, planId, { completedAt: null, completedBy: null, updatedAt: now });
  }
}

export async function complete(
  dependencies: PlanDependencies,
  membership: Membership,
  planId: string,
): Promise<PlanResult> {
  if (!(await visibleTree(dependencies, membership, planId))) {
    return { status: "not-found" };
  }

  await dependencies.plans.completeWithSubplans({
    familyId: membership.family.id,
    planId,
    memberId: membership.member.id,
    now: dependencies.clock.now(),
  });

  return currentPlan(dependencies, membership, planId);
}

export async function reopen(
  dependencies: PlanDependencies,
  membership: Membership,
  planId: string,
): Promise<PlanResult> {
  if (!(await visibleTree(dependencies, membership, planId))) {
    return { status: "not-found" };
  }

  await dependencies.plans.update(membership.family.id, planId, {
    completedAt: null,
    completedBy: null,
    updatedAt: dependencies.clock.now(),
  });

  return currentPlan(dependencies, membership, planId);
}

export async function markSubplan(
  dependencies: PlanDependencies,
  membership: Membership,
  { planId, subplanId, isDone }: SubplanTarget & { isDone: boolean },
): Promise<PlanResult> {
  const tree = await visibleTree(dependencies, membership, planId);

  if (!hasSubplan(tree, subplanId)) {
    return { status: "not-found" };
  }

  const now = dependencies.clock.now();

  await dependencies.plans.update(membership.family.id, subplanId, {
    completedAt: isDone ? now : null,
    completedBy: isDone ? membership.member.id : null,
    updatedAt: now,
  });
  await settle(dependencies, membership, planId);

  return currentPlan(dependencies, membership, planId);
}
