import {
  careKindTitles,
  expenseCategoryTitles,
  type CareDetails,
  type CareEntry,
  type ExpenseCategory,
  type ExpenseSummary,
  type Photo,
} from "@family-hub/contract";

import { formatRubles } from "@/common/money";

import type { CareEntryRow } from "./care-entry.repo.ts";

type PromotedColumns = {
  weightKg: number | null;
  expenseAmount: number | null;
  expenseCategory: ExpenseCategory | null;
};

const noColumns: PromotedColumns = {
  weightKg: null,
  expenseAmount: null,
  expenseCategory: null,
};

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

export function careTitleOf(details: CareDetails): string {
  if (details.kind === "vaccination") {
    return `${careKindTitles.vaccination}: ${details.vaccine}`;
  }

  if (details.kind === "treatment") {
    return `${careKindTitles.treatment}: ${details.target}`;
  }

  if (details.kind === "vet_visit") {
    return details.reason === null
      ? careKindTitles.vet_visit
      : `${careKindTitles.vet_visit}: ${details.reason}`;
  }

  if (details.kind === "weight") {
    return `${careKindTitles.weight}: ${details.weightKg} кг`;
  }

  return details.kind === "expense"
    ? `${expenseCategoryTitles[details.category]}: ${formatRubles(details.amount)}`
    : careKindTitles.note;
}
