import type { Completion, Plan, PlanMember, Subplan } from "@family-hub/contract";

import type { PlanRow, PlanTree } from "./plan.repo.ts";

function memberOf(id: string | null, name: string | null): PlanMember | null {
  return id === null || name === null ? null : { id, name };
}

function completionOf(row: PlanRow): Completion | null {
  return row.completedAt === null ? null : { at: row.completedAt, by: row.completedByName };
}

function toSubplan(row: PlanRow): Subplan {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.dueDate,
    assignee: memberOf(row.assigneeMemberId, row.assigneeName),
    completed: completionOf(row),
  };
}

export function toPlan({ root, subplans }: PlanTree, memberId: string): Plan {
  return {
    ...toSubplan(root),
    note: root.note,
    visibility: root.visibility ?? "shared",
    isOwn: root.ownerMemberId === memberId,
    subplans: subplans.map(toSubplan),
  };
}

export function isAllDone(subplans: PlanRow[]): boolean {
  return subplans.length > 0 && subplans.every(({ completedAt }) => completedAt !== null);
}
