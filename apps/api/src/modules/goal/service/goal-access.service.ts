import type { Goal } from "@family-hub/contract";

import type { Membership } from "@/modules/auth";

import { toGoal } from "../goal.lib.ts";
import type { GoalRow, MovementRow } from "../goal.repo.ts";
import type { GoalDependencies, GoalResult } from "../goal.types.ts";

export type VisibleGoal = { row: GoalRow; movements: MovementRow[] };

export async function visibleGoals(
  { goals }: GoalDependencies,
  { family, member }: Membership,
  goalId?: string,
): Promise<VisibleGoal[]> {
  const rows = await goals.listVisible({ familyId: family.id, memberId: member.id, goalId });
  const movements = await goals.movementsOf(
    family.id,
    rows.map(({ id }) => id),
  );

  return rows.map((row) => ({
    row,
    movements: movements.filter((movement) => movement.goalId === row.id),
  }));
}

export async function visibleGoal(
  dependencies: GoalDependencies,
  membership: Membership,
  goalId: string,
): Promise<VisibleGoal | undefined> {
  const [found] = await visibleGoals(dependencies, membership, goalId);

  return found;
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
