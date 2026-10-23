import {
  planReminder,
  type Completion,
  type Plan,
  type PlanReminder,
  type Subplan,
} from "@family-hub/contract";

import { formatDay, formatNearDate, type Viewer } from "@/common/format-date";

export type PlanListItem = {
  id: string;
  title: string;
  subtitle: string | undefined;
  isCompleted: boolean;
  isOverdue: boolean;
};

export type SubplanItem = PlanListItem;

export type PlanDetails = {
  id: string;
  title: string;
  note: string | undefined;
  facts: string | undefined;
  progress: string | undefined;
  stepsTitle: string;
  completed: string | undefined;
  isCompleted: boolean;
  isPrivate: boolean;
  canDelete: boolean;
  subplans: SubplanItem[];
  album: Plan["album"];
};

function joined(parts: Array<string | undefined>): string | undefined {
  const present = parts.filter((part) => part !== undefined);

  return present.length === 0 ? undefined : present.join(" · ");
}

// An open deadline that has passed says so in words, as the hub and the Feed do.
function deadlineOf(
  dueDate: string,
  { today, isOpen }: { today: string; isOpen: boolean },
): string {
  const day = formatNearDate(dueDate, today);

  if (isOpen && dueDate < today) {
    return `Просрочено · ${day}`;
  }

  return /\d/u.test(day) ? `до ${day}` : day;
}

function isOverdue(
  { dueDate, completed }: { dueDate: string | null; completed: Completion | null },
  today: string,
): boolean {
  return completed === null && dueDate !== null && dueDate < today;
}

function dueOf(
  dueDate: string | null,
  state: { today: string; isOpen: boolean },
): string | undefined {
  return dueDate === null ? undefined : deadlineOf(dueDate, state);
}

function progressOf({ subplans }: Plan): string | undefined {
  const done = subplans.filter(({ completed }) => completed !== null).length;

  return subplans.length === 0 ? undefined : `${done} из ${subplans.length}`;
}

function completedOf(completed: Completion | null, viewer: Viewer): string | undefined {
  if (completed === null) {
    return undefined;
  }

  return `Выполнено ${joined([formatDay(completed.at, viewer), completed.by ?? undefined])}`;
}

function isLaterThan(dueDate: string | null, planDueDate: string | null): boolean {
  return dueDate !== null && planDueDate !== null && dueDate > planDueDate;
}

function toSubplanItem(
  subplan: Subplan,
  { planDueDate, today }: { planDueDate: string | null; today: string },
): SubplanItem {
  return {
    id: subplan.id,
    title: subplan.title,
    subtitle: joined([
      dueOf(subplan.dueDate, { today, isOpen: subplan.completed === null }),
      subplan.assignee?.name,
      isLaterThan(subplan.dueDate, planDueDate) ? "позже срока плана" : undefined,
    ]),
    isCompleted: subplan.completed !== null,
    isOverdue: isOverdue(subplan, today),
  };
}

export function toListItem(plan: Plan, today: string): PlanListItem {
  return {
    id: plan.id,
    title: plan.title,
    subtitle: joined([
      dueOf(plan.dueDate, { today, isOpen: plan.completed === null }),
      plan.assignee?.name,
      progressOf(plan),
    ]),
    isCompleted: plan.completed !== null,
    isOverdue: isOverdue(plan, today),
  };
}

export function toDetails(plan: Plan, viewer: Viewer): PlanDetails {
  return {
    id: plan.id,
    title: plan.title,
    note: plan.note ?? undefined,
    facts: joined([
      dueOf(plan.dueDate, { today: viewer.today, isOpen: plan.completed === null }),
      plan.assignee?.name,
      plan.pet?.name,
    ]),
    progress: progressOf(plan),
    stepsTitle: joined(["Шаги", progressOf(plan)]) ?? "Шаги",
    completed: completedOf(plan.completed, viewer),
    isCompleted: plan.completed !== null,
    isPrivate: plan.visibility === "private",
    canDelete: plan.isOwn,
    subplans: plan.subplans.map((subplan) =>
      toSubplanItem(subplan, { planDueDate: plan.dueDate, today: viewer.today }),
    ),
    album: plan.album,
  };
}

// A Reminder hangs on the deadline, so a step without one has nothing to remind of.
export function reminderOf({ dueDate, reminder }: { dueDate: string; reminder: string }) {
  return dueDate === "" || reminder === "" ? null : planReminder.parse(reminder);
}

export function reminderValueOf(reminder: PlanReminder | null): string {
  return reminder ?? "";
}
