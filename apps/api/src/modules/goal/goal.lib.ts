import type { Goal, GoalShare, Movement } from "@family-hub/contract";

import type { GoalRow, MovementRow } from "./goal.repo.ts";

type Signed = Pick<MovementRow, "kind" | "amount">;

export function balanceOf(movements: Signed[]): number {
  let balance = 0;

  for (const { kind, amount } of movements) {
    balance += kind === "contribution" ? amount : -amount;
  }

  return balance;
}

function sharesOf(movements: MovementRow[]): GoalShare[] {
  const shares = new Map<string, GoalShare>();

  for (const { memberId, memberName, kind, amount } of movements) {
    const share = shares.get(memberId) ?? {
      id: memberId,
      name: memberName,
      contributed: 0,
      withdrawn: 0,
    };

    shares.set(
      memberId,
      kind === "contribution"
        ? { ...share, contributed: share.contributed + amount }
        : { ...share, withdrawn: share.withdrawn + amount },
    );
  }

  return [...shares.values()];
}

function toMovement(row: MovementRow, memberId: string): Movement {
  return {
    id: row.id,
    kind: row.kind,
    amount: row.amount,
    date: row.date,
    member: { id: row.memberId, name: row.memberName },
    recordedBy: { id: row.createdBy, name: row.recordedByName },
    comment: row.comment,
    isOwn: row.createdBy === memberId,
  };
}

function completionOf(row: GoalRow): Goal["completed"] {
  return row.completedAt === null || row.outcome === null
    ? null
    : { at: row.completedAt, by: row.completedByName ?? "", outcome: row.outcome };
}

export function toGoal(
  row: GoalRow,
  { movements, memberId }: { movements: MovementRow[]; memberId: string },
): Goal {
  const balance = balanceOf(movements);

  return {
    id: row.id,
    title: row.title,
    target: row.target,
    deadline: row.deadline,
    icon: row.icon,
    color: row.color,
    note: row.note,
    visibility: row.visibility,
    isOwn: row.ownerMemberId === memberId,
    balance,
    isAchieved: balance >= row.target,
    completed: completionOf(row),
    shares: sharesOf(movements),
    movements: movements.map((movement) => toMovement(movement, memberId)).toReversed(),
  };
}
