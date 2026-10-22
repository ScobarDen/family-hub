import type { InlineKeyboardMarkup } from "@grammyjs/types";

import type { Completion, Plan, PlanAlbum, Named, Subplan } from "@family-hub/contract";

import type { PlanRow, PlanTree } from "./plan.repo.ts";

function memberOf(id: string | null, name: string | null): Named | null {
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

export function toPlan(
  { root, subplans }: PlanTree,
  { memberId, album }: { memberId: string; album: PlanAlbum | null },
): Plan {
  return {
    ...toSubplan(root),
    note: root.note,
    pet: memberOf(root.petId, root.petName),
    album,
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

export function openPlanButton(url: string): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: "Открыть", url }]] };
}
