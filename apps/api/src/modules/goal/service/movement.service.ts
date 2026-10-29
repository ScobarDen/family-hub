import { uuidv7, type MovementChange } from "@family-hub/contract";

import type { Membership } from "@/modules/auth";

import { balanceOf } from "../goal.lib.ts";
import type { MovementRow } from "../goal.repo.ts";
import type { GoalDependencies, GoalRefusal, GoalResult } from "../goal.types.ts";
import { currentGoal, visibleGoal, type VisibleGoal } from "./goal-access.service.ts";

type MovementTarget = { goalId: string; movementId: string };

type OwnMovement = { found: VisibleGoal; movement: MovementRow };

// A Private Goal belongs to its owner alone, so only they put money into it.
async function contributorRefusal(
  { goals }: GoalDependencies,
  { family }: Membership,
  { found, contributorId }: { found: VisibleGoal; contributorId: string },
): Promise<GoalRefusal | undefined> {
  const isAllowed =
    found.row.visibility === "private"
      ? contributorId === found.row.ownerMemberId
      : await goals.isInFamily(family.id, contributorId);

  return isAllowed ? undefined : "contributor-not-allowed";
}

function isBelowZero(movements: Array<Pick<MovementRow, "kind" | "amount">>): boolean {
  return balanceOf(movements) < 0;
}

async function openGoal(
  dependencies: GoalDependencies,
  membership: Membership,
  goalId: string,
): Promise<VisibleGoal | GoalRefusal> {
  const found = await visibleGoal(dependencies, membership, goalId);

  if (!found) {
    return "not-found";
  }

  return found.row.completedAt === null ? found : "completed";
}

async function changeRefusal(
  dependencies: GoalDependencies,
  membership: Membership,
  {
    found,
    contributorId,
    after,
  }: {
    found: VisibleGoal;
    contributorId: string;
    after: Array<Pick<MovementRow, "kind" | "amount">>;
  },
): Promise<GoalRefusal | undefined> {
  const refusal = await contributorRefusal(dependencies, membership, { found, contributorId });

  return refusal ?? (isBelowZero(after) ? "balance-negative" : undefined);
}

export async function addMovement(
  dependencies: GoalDependencies,
  membership: Membership,
  { goalId, change }: { goalId: string; change: MovementChange },
): Promise<GoalResult> {
  const found = await openGoal(dependencies, membership, goalId);

  if (typeof found === "string") {
    return { status: found };
  }

  const contributorId = change.memberId ?? membership.member.id;
  const after = [...found.movements, change];
  const refusal = await changeRefusal(dependencies, membership, { found, contributorId, after });

  if (refusal !== undefined) {
    return { status: refusal };
  }

  const now = dependencies.clock.now();
  const id = uuidv7(now);

  await dependencies.goals.addMovement({
    id,
    familyId: membership.family.id,
    goalId,
    kind: change.kind,
    amount: change.amount,
    date: change.date,
    memberId: contributorId,
    comment: change.comment,
    createdAt: now,
    createdBy: membership.member.id,
    updatedAt: now,
  });

  return keptAboveZero(dependencies, membership, { goalId, movementId: id });
}

// Two withdrawals sent at once each pass the check above; read back, the balance shows whether
// this one went below zero, and then it is taken out again.
async function keptAboveZero(
  dependencies: GoalDependencies,
  membership: Membership,
  { goalId, movementId }: MovementTarget,
): Promise<GoalResult> {
  const familyId = membership.family.id;

  if (isBelowZero(await dependencies.goals.movementsOf(familyId, [goalId]))) {
    await dependencies.goals.deleteMovement({ familyId, movementId });

    return { status: "balance-negative" };
  }

  return currentGoal(dependencies, membership, goalId);
}

// Only the Member who recorded a movement changes or deletes it.
async function ownMovement(
  dependencies: GoalDependencies,
  membership: Membership,
  { goalId, movementId }: MovementTarget,
): Promise<OwnMovement | GoalRefusal> {
  const found = await openGoal(dependencies, membership, goalId);

  if (typeof found === "string") {
    return found;
  }

  const movement = found.movements.find(({ id }) => id === movementId);

  if (!movement) {
    return "movement-not-found";
  }

  return movement.createdBy === membership.member.id ? { found, movement } : "not-author";
}

export async function updateMovement(
  dependencies: GoalDependencies,
  membership: Membership,
  { change, ...target }: MovementTarget & { change: MovementChange },
): Promise<GoalResult> {
  const own = await ownMovement(dependencies, membership, target);

  if (typeof own === "string") {
    return { status: own };
  }

  const contributorId = change.memberId ?? own.movement.memberId;
  const after = [...own.found.movements.filter(({ id }) => id !== target.movementId), change];
  const refusal = await changeRefusal(dependencies, membership, {
    found: own.found,
    contributorId,
    after,
  });

  if (refusal !== undefined) {
    return { status: refusal };
  }

  await dependencies.goals.updateMovement(
    { familyId: membership.family.id, movementId: target.movementId },
    { ...change, memberId: contributorId, updatedAt: dependencies.clock.now() },
  );

  return currentGoal(dependencies, membership, target.goalId);
}

export async function removeMovement(
  dependencies: GoalDependencies,
  membership: Membership,
  target: MovementTarget,
): Promise<GoalResult> {
  const own = await ownMovement(dependencies, membership, target);

  if (typeof own === "string") {
    return { status: own };
  }

  if (isBelowZero(own.found.movements.filter(({ id }) => id !== target.movementId))) {
    return { status: "balance-negative" };
  }

  await dependencies.goals.deleteMovement({
    familyId: membership.family.id,
    movementId: target.movementId,
  });

  return currentGoal(dependencies, membership, target.goalId);
}
