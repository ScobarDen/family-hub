import type { CareDetails, CareEntry, ExpenseCategory, ExpenseSummary } from "@family-hub/contract";

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

export function toCareEntry(row: CareEntryRow): CareEntry {
  return {
    id: row.id,
    petId: row.petId,
    occurredAt: row.occurredAt,
    note: row.note,
    details: row.details,
    author: row.authorName,
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
