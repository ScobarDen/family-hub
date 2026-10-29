import { Temporal } from "temporal-polyfill";

import {
  careKindTitles,
  expenseCategoryTitles,
  type CareDetails,
  type CareEntry,
  type ExpenseSummary,
  type Photo,
} from "@family-hub/contract";

import { formatDay, type Viewer } from "@/common/format-date.lib.ts";
import { formatRubles } from "@/common/format-money.lib.ts";

import type { Range } from "./care.api.ts";
import type { WeightRange } from "./care.config.ts";

export type TaskCareKind = { kind: "vaccination" | "treatment" | "vet_visit"; subject: string };

// A Pet's Task is titled «Прививка: <vaccine>», «Обработка: <target>» or «Визит к ветеринару», as
// the move from Due Dates and «Повторить» name them.
export function careKindOfTask(title: string): TaskCareKind | undefined {
  for (const kind of ["vaccination", "treatment"] as const) {
    const prefix = `${careKindTitles[kind]}: `;

    if (title.startsWith(prefix)) {
      return { kind, subject: title.slice(prefix.length) };
    }
  }

  return title.startsWith(careKindTitles.vet_visit)
    ? {
        kind: "vet_visit",
        subject: title.slice(careKindTitles.vet_visit.length).replace(/^:\s*/u, ""),
      }
    : undefined;
}

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
    return `${careKindTitles.weight}: ${formatKilograms(details.weightKg)}`;
  }

  return details.kind === "expense" ? expenseCategoryTitles[details.category] : careKindTitles.note;
}

export function toJournalItem(entry: CareEntry, viewer: Viewer): JournalItem {
  const parts = [formatDay(entry.occurredAt, viewer), entry.author, costOf(entry.details)];

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
      title: expenseCategoryTitles[category],
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

export type WeightSummary = { latest: string; change: string | undefined };

const signedKilograms = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

// The change is counted between the first and the last weighing shown, so it names the chart's own span.
export function weightSummaryOf(points: WeightPoint[]): WeightSummary | undefined {
  const first = points.at(0);
  const last = points.at(-1);

  if (first === undefined || last === undefined) {
    return undefined;
  }

  const delta = Number((last.kg - first.kg).toFixed(1));

  return {
    latest: formatKilograms(last.kg),
    change:
      first === last
        ? undefined
        : `${delta === 0 ? "Без изменений" : `${signedKilograms.format(delta)} кг`} с ${first.label}`,
  };
}

export function weightPoints(
  entries: CareEntry[],
  { range, today, timeZone }: { range: WeightRange; today: string; timeZone: string },
): WeightPoint[] {
  const since = sinceOf(range, today, timeZone);

  return entries
    .flatMap(({ occurredAt, details }) =>
      details.kind === "weight" && occurredAt >= since
        ? [
            {
              at: occurredAt,
              kg: details.weightKg,
              label: formatDay(occurredAt, { today, timeZone }),
            },
          ]
        : [],
    )
    .toSorted((left, right) => left.at - right.at);
}
