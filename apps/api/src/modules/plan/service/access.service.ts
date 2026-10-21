import type { Membership } from "@/common/auth";

import type { PlanTree } from "../plan.repo.ts";
import type { Assignment, PlanDependencies, PlanResult } from "../plan.types.ts";
import { planOf } from "./plan-album.service.ts";

export async function visibleTree(
  { plans }: PlanDependencies,
  { family, member }: Membership,
  planId: string,
): Promise<PlanTree | undefined> {
  const tree = await plans.findTree(family.id, planId);
  const isHidden = tree?.root.visibility === "private" && tree.root.ownerMemberId !== member.id;

  return isHidden ? undefined : tree;
}

// A Private Plan's Assignee could reveal the surprise, so it is its owner or nobody.
export async function isAssigneeAllowed(
  { plans }: PlanDependencies,
  { family }: Membership,
  { assigneeId, visibility, ownerId }: Assignment,
): Promise<boolean> {
  if (assigneeId === null) {
    return true;
  }

  if (visibility === "private") {
    return assigneeId === ownerId;
  }

  return plans.isInFamily(family.id, assigneeId);
}

export async function currentPlan(
  dependencies: PlanDependencies,
  membership: Membership,
  planId: string,
): Promise<PlanResult> {
  const tree = await dependencies.plans.findTree(membership.family.id, planId);

  return tree
    ? { status: "ok", plan: await planOf(dependencies, membership, tree) }
    : { status: "not-found" };
}

export function hasSubplan(tree: PlanTree | undefined, subplanId: string): tree is PlanTree {
  return tree?.subplans.some(({ id }) => id === subplanId) === true;
}
