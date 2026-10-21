import type { InlineKeyboardMarkup } from "@grammyjs/types";

import {
  encodeDeepLink,
  type Completion,
  type Plan,
  type PlanMember,
  type Subplan,
} from "@family-hub/contract";

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
    reminder: row.reminder,
    assignee: memberOf(row.assigneeMemberId, row.assigneeName),
    completed: completionOf(row),
  };
}

export function toPlan({ root, subplans }: PlanTree, memberId: string): Plan {
  return {
    ...toSubplan(root),
    note: root.note,
    pet: memberOf(root.petId, root.petName),
    visibility: root.visibility ?? "shared",
    isOwn: root.ownerMemberId === memberId,
    subplans: subplans.map(toSubplan),
  };
}

export function isAllDone(subplans: PlanRow[]): boolean {
  return subplans.length > 0 && subplans.every(({ completedAt }) => completedAt !== null);
}

const dayAndMonth = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

// A due date is a floating calendar day, so it is shown as that day in UTC, not in a zone.
function formatDueDate(dueDate: string): string {
  const [year = 0, month = 1, day = 1] = dueDate.split("-").map(Number);

  return dayAndMonth.format(Date.UTC(year, month - 1, day));
}

type AssignedText = { assignerName: string; title: string; dueDate: string | null };

export function assignedText({ assignerName, title, dueDate }: AssignedText): string {
  const due = dueDate === null ? "" : ` · до ${formatDueDate(dueDate)}`;

  return `🧑 ${assignerName} назначил(а) тебе: ${title}${due}`;
}

// The bot's Main Mini App opens from t.me/<bot>, so the link needs no app short name.
export function openPlanButton(botUsername: string, planId: string): InlineKeyboardMarkup {
  const link = new URL(`https://t.me/${botUsername}`);

  link.searchParams.set("startapp", encodeDeepLink({ kind: "plan", id: planId }));

  return { inline_keyboard: [[{ text: "Открыть", url: link.toString() }]] };
}
