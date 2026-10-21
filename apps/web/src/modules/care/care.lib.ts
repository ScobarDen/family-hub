import { Temporal } from "temporal-polyfill";

import type { CareDetails, CareEntry, ExpenseSummary, Photo } from "@family-hub/contract";

import { formatDay } from "@/common/format-date";
import { formatRubles } from "@/common/format-money";

import type { Range } from "./care.api.ts";
import { categoryTitles, kindTitles, type WeightRange } from "./care.config.ts";

export type JournalItem = {
  id: string;
  title: string;
  subtitle: string;
  note: string | undefined;
  photos: Photo[];
};

export type ExpenseRow = { title: string; amount: string };

export type ExpensesView = { total: string; rows: ExpenseRow[] };

export type WeightPoint = { at: number; kg: number; label: string };

const kilograms = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

function startOfDay(date: Temporal.PlainDate, timeZone: string): number {
  return date.toZonedDateTime({ timeZone }).epochMilliseconds;
}

// Months and years are counted in the viewer's zone, where «this month» is what they mean.
export function monthRange(today: string, timeZone: string): Range {
  const first = Temporal.PlainDate.from(today).with({ day: 1 });

  return { from: startOfDay(first, timeZone), to: startOfDay(first.add({ months: 1 }), timeZone) };
}

export function yearRange(today: string, timeZone: string): Range {
  const first = Temporal.PlainDate.from(today).with({ month: 1, day: 1 });

  return { from: startOfDay(first, timeZone), to: startOfDay(first.add({ years: 1 }), timeZone) };
}

export function formatKilograms(kg: number): string {
  return `${kilograms.format(kg)} кг`;
}

function costOf(details: CareDetails): string | undefined {
  if (details.kind === "expense") {
    return formatRubles(details.amount);
  }

  return "cost" in details && details.cost !== null ? formatRubles(details.cost.amount) : undefined;
}

export function titleOf(details: CareDetails): string {
  if (details.kind === "vaccination") {
    return `${kindTitles.vaccination}: ${details.vaccine}`;
  }

  if (details.kind === "treatment") {
    return `${kindTitles.treatment}: ${details.target}`;
  }

  if (details.kind === "vet_visit") {
    return details.reason === null
      ? kindTitles.vet_visit
      : `${kindTitles.vet_visit}: ${details.reason}`;
  }

  if (details.kind === "weight") {
    return `${kindTitles.weight}: ${formatKilograms(details.weightKg)}`;
  }

  return details.kind === "expense" ? categoryTitles[details.category] : kindTitles.note;
}

export function toJournalItem(entry: CareEntry, timeZone: string): JournalItem {
  const parts = [formatDay(entry.occurredAt, timeZone), entry.author, costOf(entry.details)];

  return {
    id: entry.id,
    title: titleOf(entry.details),
    subtitle: parts.filter((part) => part !== null && part !== undefined).join(" · "),
    note: entry.note ?? undefined,
    photos: entry.photos,
  };
}

// The Pet's photos are those of its entries, newest entry first, each photo once.
export function petPhotosOf(entries: CareEntry[]): Photo[] {
  const seen = new Set<string>();

  return entries.flatMap(({ photos }) =>
    photos.filter(({ id }) => {
      const isNew = !seen.has(id);

      seen.add(id);

      return isNew;
    }),
  );
}

export function toExpensesView(summary: ExpenseSummary): ExpensesView {
  return {
    total: formatRubles(summary.total),
    rows: summary.byCategory.map(({ category, amount }) => ({
      title: categoryTitles[category],
      amount: formatRubles(amount),
    })),
  };
}

function sinceOf(range: WeightRange, today: string, timeZone: string): number {
  const date = Temporal.PlainDate.from(today);

  if (range === "quarter") {
    return startOfDay(date.subtract({ months: 3 }), timeZone);
  }

  return range === "year" ? startOfDay(date.subtract({ years: 1 }), timeZone) : 0;
}

export function weightPoints(
  entries: CareEntry[],
  { range, today, timeZone }: { range: WeightRange; today: string; timeZone: string },
): WeightPoint[] {
  const since = sinceOf(range, today, timeZone);

  return entries
    .flatMap(({ occurredAt, details }) =>
      details.kind === "weight" && occurredAt >= since
        ? [{ at: occurredAt, kg: details.weightKg, label: formatDay(occurredAt, timeZone) }]
        : [],
    )
    .toSorted((left, right) => left.at - right.at);
}
