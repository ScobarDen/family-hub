import { Temporal } from "temporal-polyfill";

import type { Goal, GoalColor, GoalIcon } from "@family-hub/contract";

import { formatDay, formatShortDate, type Viewer } from "@/common/format-date";
import { formatRubles } from "@/common/format-money";

import { outcomeTitles } from "./goals.config.ts";

export type GoalListItem = {
  id: string;
  title: string;
  icon: GoalIcon;
  color: GoalColor;
  subtitle: string;
  percent: number;
  // The list's line: the balance with how much of the target it is.
  progress: string;
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

  // Under a month left, «Осталось … до …» already says it all.
  const left = Temporal.PlainDate.from(today).until(goal.deadline, { largestUnit: "months" });

  if (left.years === 0 && left.months === 0) {
    return undefined;
  }

  return `~${formatRubles(Math.ceil(remaining / monthsUntil(today, goal.deadline)))} / мес`;
}

export function toListItem(goal: Goal): GoalListItem {
  const subtitle = `${formatRubles(goal.balance)} из ${formatRubles(goal.target)}`;
  const percent = Math.min(fullPercent, Math.floor((goal.balance / goal.target) * fullPercent));

  return {
    id: goal.id,
    title: goal.title,
    icon: goal.icon,
    color: goal.color,
    subtitle,
    percent,
    progress: `${subtitle} · ${percent}%`,
  };
}

function statusOf(goal: Goal, viewer: Viewer): string | undefined {
  if (goal.completed !== null) {
    const { outcome, by, at } = goal.completed;

    return `${outcomeTitles[outcome]} · ${by}, ${formatDay(at, viewer)}`;
  }

  return goal.isAchieved ? "Цель достигнута" : undefined;
}

function movementOf(movement: Goal["movements"][number], today: string): MovementItem {
  const sign = movement.kind === "contribution" ? "+" : "−";
  const recorder =
    movement.recordedBy.id === movement.member.id
      ? ""
      : ` · записал(а) ${movement.recordedBy.name}`;

  return {
    id: movement.id,
    title: `${sign}${formatRubles(movement.amount)} · ${movement.member.name}`,
    subtitle: [formatShortDate(movement.date, today) + recorder, movement.comment]
      .filter((part) => part !== null)
      .join(" · "),
    isOwn: movement.isOwn,
  };
}

export function toDetails(goal: Goal, viewer: Viewer): GoalDetails {
  const { today } = viewer;
  const remaining = goal.target - goal.balance;

  return {
    ...toListItem(goal),
    note: goal.note ?? undefined,
    remaining:
      remaining > 0
        ? `Осталось ${formatRubles(remaining)}${goal.deadline === null ? "" : ` до ${formatShortDate(goal.deadline, today)}`}`
        : undefined,
    hint: monthlyHint(goal, today),
    status: statusOf(goal, viewer),
    shares: goal.shares.map(({ id, name, contributed, withdrawn }) => ({
      id,
      name,
      subtitle: `внесено ${formatRubles(contributed)} / снято ${formatRubles(withdrawn)}`,
    })),
    movements: goal.movements.map((movement) => movementOf(movement, today)),
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

type Movement = Goal["movements"][number];

function sharesWith(goal: Goal, { kind, amount, member }: Movement, sign: 1 | -1): Goal["shares"] {
  const shares = goal.shares.some(({ id }) => id === member.id)
    ? goal.shares
    : [...goal.shares, { ...member, contributed: 0, withdrawn: 0 }];

  return shares.map((share) =>
    share.id === member.id
      ? {
          ...share,
          contributed: share.contributed + (kind === "contribution" ? sign * amount : 0),
          withdrawn: share.withdrawn + (kind === "withdrawal" ? sign * amount : 0),
        }
      : share,
  );
}

function moved(goal: Goal, movement: Movement, sign: 1 | -1): Goal {
  const balance =
    goal.balance + sign * (movement.kind === "contribution" ? 1 : -1) * movement.amount;

  return {
    ...goal,
    balance,
    isAchieved: balance >= goal.target,
    shares: sharesWith(goal, movement, sign),
  };
}

export function withMovement(goal: Goal, movement: Movement): Goal {
  return { ...moved(goal, movement, 1), movements: [movement, ...goal.movements] };
}

export function withoutMovement(goal: Goal, movementId: string): Goal {
  const movement = goal.movements.find(({ id }) => id === movementId);

  return movement === undefined
    ? goal
    : {
        ...moved(goal, movement, -1),
        movements: goal.movements.filter(({ id }) => id !== movementId),
      };
}
