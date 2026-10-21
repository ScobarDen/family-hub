import type {
  CareDetails,
  CareEntry,
  DueDateItem,
  ExpenseCategory,
  ExpenseSummary,
  Photo,
} from "@family-hub/contract";

import type { CareEntryRow } from "./care-entry.repo.ts";

export type PromotedColumns = {
  dueDate: string | null;
  dueKey: string | null;
  weightKg: number | null;
  expenseAmount: number | null;
  expenseCategory: ExpenseCategory | null;
};

const noColumns: PromotedColumns = {
  dueDate: null,
  dueKey: null,
  weightKg: null,
  expenseAmount: null,
  expenseCategory: null,
};

// A later entry of the same vaccine, treatment target or a vet visit closes the earlier Due Date.
function dueKeyOf(details: CareDetails): string | null {
  if (details.kind === "vaccination") {
    return details.vaccine.toLowerCase();
  }

  if (details.kind === "treatment") {
    return details.target.toLowerCase();
  }

  return details.kind === "vet_visit" ? "vet_visit" : null;
}

export function columnsOf(details: CareDetails): PromotedColumns {
  if (details.kind === "weight") {
    return { ...noColumns, weightKg: details.weightKg };
  }

  if (details.kind === "expense") {
    return { ...noColumns, expenseAmount: details.amount, expenseCategory: details.category };
  }

  if (details.kind === "note") {
    return noColumns;
  }

  return {
    ...noColumns,
    dueDate: details.dueDate,
    dueKey: dueKeyOf(details),
    expenseAmount: details.cost?.amount ?? null,
    expenseCategory: details.cost?.category ?? null,
  };
}

export function toCareEntry(row: CareEntryRow, photos: Photo[]): CareEntry {
  return {
    id: row.id,
    petId: row.petId,
    occurredAt: row.occurredAt,
    note: row.note,
    details: row.details,
    author: row.authorName,
    photos,
  };
}

export function summaryOf(rows: CareEntryRow[]): ExpenseSummary {
  const entries = rows.flatMap(({ id, occurredAt, kind, expenseAmount, expenseCategory }) =>
    expenseAmount === null || expenseCategory === null
      ? []
      : [{ id, occurredAt, kind, amount: expenseAmount, category: expenseCategory }],
  );
  const byCategory = new Map<ExpenseCategory, number>();

  for (const { category, amount } of entries) {
    byCategory.set(category, (byCategory.get(category) ?? 0) + amount);
  }

  return {
    total: entries.reduce((sum, { amount }) => sum + amount, 0),
    byCategory: [...byCategory]
      .map(([category, amount]) => ({ category, amount }))
      .toSorted((left, right) => right.amount - left.amount),
    entries,
  };
}

// A Due Date is a calendar day, overdue once the Member's own day has passed it.
export function todayIn(timeZone: string | null, now: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dueTitleOf(details: CareDetails): string {
  if (details.kind === "vaccination") {
    return details.vaccine;
  }

  return details.kind === "treatment" ? details.target : "Визит к ветеринару";
}

function dueItemOf(row: CareEntryRow, today: string): DueDateItem[] {
  const { details, dueDate } = row;

  if (
    dueDate === null ||
    details.kind === "weight" ||
    details.kind === "expense" ||
    details.kind === "note"
  ) {
    return [];
  }

  return [
    {
      entryId: row.id,
      kind: details.kind,
      title: dueTitleOf(details),
      dueDate,
      isOverdue: dueDate < today,
    },
  ];
}

// The newest entry of each due key holds its Due Date: a later vaccine of the same name closes
// the earlier one, and a later entry without a date closes it for good.
export function openDueDates(rows: CareEntryRow[], today: string): DueDateItem[] {
  const newest = new Map<string, CareEntryRow>();

  for (const row of rows) {
    if (row.dueKey !== null && !newest.has(row.dueKey)) {
      newest.set(row.dueKey, row);
    }
  }

  return [...newest.values()]
    .flatMap((row) => dueItemOf(row, today))
    .toSorted((left, right) => (left.dueDate < right.dueDate ? -1 : 1));
}
