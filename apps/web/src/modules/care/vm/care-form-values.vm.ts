import { Temporal } from "temporal-polyfill";

import {
  careEntryChange,
  careKind,
  type CareDetails,
  type CareEntry,
  type CareEntryChange,
  type CareKind,
} from "@family-hub/contract";

export const emptyEntry = {
  kind: "note",
  occurredAt: "",
  note: "",
  name: "",
  product: "",
  reason: "",
  costAmount: "",
  costCategory: "vet",
  dueDate: "",
  weightKg: "",
  amount: "",
  category: "food",
};

export type EntryValues = typeof emptyEntry;

function textOrNull(text: string): string | null {
  return text.trim() === "" ? null : text.trim();
}

function costOf(values: EntryValues) {
  return values.costAmount.trim() === ""
    ? null
    : { amount: Number(values.costAmount), category: values.costCategory };
}

function medicalOf(values: EntryValues) {
  return { cost: costOf(values), dueDate: textOrNull(values.dueDate) };
}

const detailsBuilders: Record<CareKind, (values: EntryValues) => unknown> = {
  vaccination: (values) => ({ kind: "vaccination", vaccine: values.name, ...medicalOf(values) }),
  treatment: (values) => ({
    kind: "treatment",
    target: values.name,
    product: values.product,
    ...medicalOf(values),
  }),
  vet_visit: (values) => ({ kind: "vet_visit", reason: values.reason, ...medicalOf(values) }),
  weight: (values) => ({ kind: "weight", weightKg: Number(values.weightKg.replace(",", ".")) }),
  expense: (values) => ({
    kind: "expense",
    amount: Number(values.amount),
    category: values.category,
  }),
  note: () => ({ kind: "note" }),
};

export function detailsOf(values: EntryValues): unknown {
  const kind = careKind.safeParse(values.kind);

  return kind.success ? detailsBuilders[kind.data](values) : undefined;
}

export function changeOf(values: EntryValues, timeZone: string): CareEntryChange {
  return careEntryChange.parse({
    occurredAt: Temporal.PlainDateTime.from(values.occurredAt).toZonedDateTime(timeZone)
      .epochMilliseconds,
    note: values.note,
    details: detailsOf(values),
  });
}

function medicalValuesOf(details: CareDetails): Partial<EntryValues> {
  if (details.kind === "vaccination") {
    return { name: details.vaccine };
  }

  if (details.kind === "treatment") {
    return { name: details.target, product: details.product ?? "" };
  }

  return details.kind === "vet_visit" ? { reason: details.reason ?? "" } : {};
}

function kindValuesOf(details: CareDetails): Partial<EntryValues> {
  if (details.kind === "weight") {
    return { weightKg: String(details.weightKg) };
  }

  if (details.kind === "expense") {
    return { amount: String(details.amount), category: details.category };
  }

  if (details.kind === "note") {
    return {};
  }

  return {
    ...medicalValuesOf(details),
    costAmount: details.cost === null ? "" : String(details.cost.amount),
    costCategory: details.cost?.category ?? "vet",
    dueDate: details.dueDate ?? "",
  };
}

export function valuesOf(entry: CareEntry, timeZone: string): EntryValues {
  const occurredAt = Temporal.Instant.fromEpochMilliseconds(entry.occurredAt)
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });

  return {
    ...emptyEntry,
    kind: entry.details.kind,
    occurredAt,
    note: entry.note ?? "",
    ...kindValuesOf(entry.details),
  };
}
