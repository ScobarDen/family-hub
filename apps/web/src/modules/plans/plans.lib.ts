import type { Completion, Plan, Subplan } from "@family-hub/contract";

import { formatDate, formatDay } from "@/common/format-date";

export type PlanListItem = {
  id: string;
  title: string;
  subtitle: string | undefined;
  isCompleted: boolean;
};

export type SubplanItem = PlanListItem & { isLaterThanPlan: boolean };

export type PlanDetails = {
  id: string;
  title: string;
  note: string | undefined;
  facts: string | undefined;
  progress: string | undefined;
  completed: string | undefined;
  isCompleted: boolean;
  isPrivate: boolean;
  canDelete: boolean;
  subplans: SubplanItem[];
};

function joined(parts: Array<string | undefined>): string | undefined {
  const present = parts.filter((part) => part !== undefined);

  return present.length === 0 ? undefined : present.join(" · ");
}

function dueOf(dueDate: string | null): string | undefined {
  return dueDate === null ? undefined : `до ${formatDate(dueDate)}`;
}

function progressOf({ subplans }: Plan): string | undefined {
  const done = subplans.filter(({ completed }) => completed !== null).length;

  return subplans.length === 0 ? undefined : `${done} из ${subplans.length}`;
}

function completedOf(completed: Completion | null, timeZone: string): string | undefined {
  if (completed === null) {
    return undefined;
  }

  return `Выполнено ${joined([formatDay(completed.at, timeZone), completed.by ?? undefined])}`;
}

function toSubplanItem(subplan: Subplan, planDueDate: string | null): SubplanItem {
  return {
    id: subplan.id,
    title: subplan.title,
    subtitle: joined([dueOf(subplan.dueDate), subplan.assignee?.name]),
    isCompleted: subplan.completed !== null,
    isLaterThanPlan:
      subplan.dueDate !== null && planDueDate !== null && subplan.dueDate > planDueDate,
  };
}

export function toListItem(plan: Plan): PlanListItem {
  return {
    id: plan.id,
    title: plan.title,
    subtitle: joined([dueOf(plan.dueDate), plan.assignee?.name, progressOf(plan)]),
    isCompleted: plan.completed !== null,
  };
}

export function toDetails(plan: Plan, timeZone: string): PlanDetails {
  return {
    id: plan.id,
    title: plan.title,
    note: plan.note ?? undefined,
    facts: joined([dueOf(plan.dueDate), plan.assignee?.name]),
    progress: progressOf(plan),
    completed: completedOf(plan.completed, timeZone),
    isCompleted: plan.completed !== null,
    isPrivate: plan.visibility === "private",
    canDelete: plan.isOwn,
    subplans: plan.subplans.map((subplan) => toSubplanItem(subplan, plan.dueDate)),
  };
}
