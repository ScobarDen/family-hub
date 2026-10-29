import { uuidv7, type GoalChange, type GoalList, type GoalOutcome } from "@family-hub/contract";

import { isTurnedPrivate } from "@/common/visibility.lib.ts";
import type { Membership } from "@/modules/auth";

import type { GoalDependencies, GoalResult } from "../goal.types.ts";
import { currentGoal, goalOf, visibleGoal, visibleGoals } from "./goal-access.service.ts";

export async function list(
  dependencies: GoalDependencies,
  membership: Membership,
): Promise<GoalList> {
  const visible = await visibleGoals(dependencies, membership);
  const goals = visible.map((found) => goalOf(found, membership));
  let totalSaved = 0;

  for (const { completed, balance } of goals) {
    totalSaved += completed === null ? balance : 0;
  }

  return { goals, totalSaved };
}

export async function create(
  dependencies: GoalDependencies,
  membership: Membership,
  change: GoalChange,
): Promise<GoalResult> {
  const now = dependencies.clock.now();
  const id = uuidv7(now);

  await dependencies.goals.add({
    id,
    familyId: membership.family.id,
    ownerMemberId: membership.member.id,
    ...change,
    createdAt: now,
    createdBy: membership.member.id,
    updatedAt: now,
  });

  return currentGoal(dependencies, membership, id);
}

export async function update(
  dependencies: GoalDependencies,
  membership: Membership,
  { goalId, change }: { goalId: string; change: GoalChange },
): Promise<GoalResult> {
  const found = await visibleGoal(dependencies, membership, goalId);

  if (!found) {
    return { status: "not-found" };
  }

  if (found.row.completedAt !== null) {
    return { status: "completed" };
  }

  // Others may already have put money into a Shared Goal, so it never turns Private.
  if (isTurnedPrivate(found.row.visibility, change.visibility)) {
    return { status: "visibility-one-way" };
  }

  await dependencies.goals.update(
    { familyId: membership.family.id, goalId },
    { ...change, updatedAt: dependencies.clock.now() },
  );

  return currentGoal(dependencies, membership, goalId);
}

// A Completed Goal is read-only from then on, its Balance frozen as it was.
export async function complete(
  dependencies: GoalDependencies,
  membership: Membership,
  { goalId, outcome }: { goalId: string; outcome: GoalOutcome },
): Promise<GoalResult> {
  const found = await visibleGoal(dependencies, membership, goalId);

  if (!found) {
    return { status: "not-found" };
  }

  if (found.row.completedAt !== null) {
    return { status: "completed" };
  }

  const now = dependencies.clock.now();

  await dependencies.goals.update(
    { familyId: membership.family.id, goalId },
    { completedAt: now, completedBy: membership.member.id, outcome, updatedAt: now },
  );

  return currentGoal(dependencies, membership, goalId);
}
