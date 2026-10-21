import type { Goal } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import { toGoal } from "../goal.lib.ts";
import type { GoalRow, MovementRow } from "../goal.repo.ts";
import type { GoalDependencies, GoalResult } from "../goal.types.ts";

export type VisibleGoal = { row: GoalRow; movements: MovementRow[] };

export async function visibleGoals(
  { goals }: GoalDependencies,
  { family, member }: Membership,
): Promise<VisibleGoal[]> {
  const rows = await goals.listVisible(family.id, member.id);
  const movements = await goals.movementsOf(
    family.id,
    rows.map(({ id }) => id),
  );

  return rows.map((row) => ({
    row,
    movements: movements.filter(({ goalId }) => goalId === row.id),
  }));
}

export async function visibleGoal(
  dependencies: GoalDependencies,
  membership: Membership,
  goalId: string,
): Promise<VisibleGoal | undefined> {
  const all = await visibleGoals(dependencies, membership);

  return all.find(({ row }) => row.id === goalId);
}

export function goalOf({ row, movements }: VisibleGoal, { member }: Membership): Goal {
  return toGoal(row, { movements, memberId: member.id });
}

export async function currentGoal(
  dependencies: GoalDependencies,
  membership: Membership,
  goalId: string,
): Promise<GoalResult> {
  const found = await visibleGoal(dependencies, membership, goalId);

  return found ? { status: "ok", goal: goalOf(found, membership) } : { status: "not-found" };
}
