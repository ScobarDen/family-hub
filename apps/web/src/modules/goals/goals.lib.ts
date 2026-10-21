import { Temporal } from "temporal-polyfill";

import type { Goal, GoalColor, GoalIcon } from "@family-hub/contract";

import { formatDate, formatDay } from "@/common/format-date";
import { formatRubles } from "@/common/format-money";

import { outcomeTitles } from "./goals.config.ts";

export type GoalListItem = {
  id: string;
  title: string;
  icon: GoalIcon;
  color: GoalColor;
  subtitle: string;
  percent: number;
};

export type MovementItem = {
  id: string;
  title: string;
  subtitle: string;
  isOwn: boolean;
};

export type GoalDetails = GoalListItem & {
  note: string | undefined;
  remaining: string | undefined;
  hint: string | undefined;
  status: string | undefined;
  shares: Array<{ id: string; name: string; subtitle: string }>;
  movements: MovementItem[];
  isReadOnly: boolean;
};

const fullPercent = 100;
const monthsPerYear = 12;

function monthsUntil(today: string, deadline: string): number {
  const left = Temporal.PlainDate.from(today).until(deadline, { largestUnit: "months" });

  return Math.max(1, left.months + left.years * monthsPerYear + (left.days > 0 ? 1 : 0));
}

// How much to put aside each month to reach the target by the deadline, rounded up to a ruble.
export function monthlyHint(goal: Goal, today: string): string | undefined {
  const remaining = goal.target - goal.balance;

  if (goal.deadline === null || goal.completed !== null || remaining <= 0) {
    return undefined;
  }

  if (goal.deadline < today) {
    return "Срок прошёл";
  }

  return `~${formatRubles(Math.ceil(remaining / monthsUntil(today, goal.deadline)))} / мес`;
}

export function toListItem(goal: Goal): GoalListItem {
  return {
    id: goal.id,
    title: goal.title,
    icon: goal.icon,
    color: goal.color,
    subtitle: `${formatRubles(goal.balance)} из ${formatRubles(goal.target)}`,
    percent: Math.min(fullPercent, Math.floor((goal.balance / goal.target) * fullPercent)),
  };
}

function statusOf(goal: Goal, timeZone: string): string | undefined {
  if (goal.completed !== null) {
    const { outcome, by, at } = goal.completed;

    return `${outcomeTitles[outcome]} · ${by}, ${formatDay(at, timeZone)}`;
  }

  return goal.isAchieved ? "Цель достигнута 🎉" : undefined;
}

function movementOf(movement: Goal["movements"][number]): MovementItem {
  const sign = movement.kind === "contribution" ? "+" : "−";
  const recorder =
    movement.recordedBy.id === movement.member.id
      ? ""
      : ` · записал(а) ${movement.recordedBy.name}`;

  return {
    id: movement.id,
    title: `${sign}${formatRubles(movement.amount)} · ${movement.member.name}`,
    subtitle: [formatDate(movement.date) + recorder, movement.comment]
      .filter((part) => part !== null)
      .join(" · "),
    isOwn: movement.isOwn,
  };
}

export function toDetails(
  goal: Goal,
  { today, timeZone }: { today: string; timeZone: string },
): GoalDetails {
  const remaining = goal.target - goal.balance;

  return {
    ...toListItem(goal),
    note: goal.note ?? undefined,
    remaining:
      remaining > 0
        ? `Осталось ${formatRubles(remaining)}${goal.deadline === null ? "" : ` до ${formatDate(goal.deadline)}`}`
        : undefined,
    hint: monthlyHint(goal, today),
    status: statusOf(goal, timeZone),
    shares: goal.shares.map(({ id, name, contributed, withdrawn }) => ({
      id,
      name,
      subtitle: `внесено ${formatRubles(contributed)} / снято ${formatRubles(withdrawn)}`,
    })),
    movements: goal.movements.map(movementOf),
    isReadOnly: goal.completed !== null,
  };
}

export type GoalSections = {
  active: GoalListItem[];
  achieved: GoalListItem[];
  archive: GoalListItem[];
};

export function sectionsOf(goals: Goal[]): GoalSections {
  const open = goals.filter(({ completed }) => completed === null);

  return {
    active: open.filter(({ isAchieved }) => !isAchieved).map(toListItem),
    achieved: open.filter(({ isAchieved }) => isAchieved).map(toListItem),
    archive: goals.filter(({ completed }) => completed !== null).map(toListItem),
  };
}
