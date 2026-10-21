import { action, atom, computed, noop, reatomForm, wrap } from "@reatom/core";
import { Temporal } from "temporal-polyfill";
import { z } from "zod";

import {
  careEntryChange,
  careKind,
  type CareDetails,
  type CareEntry,
  type CareEntryChange,
  type CareKind,
} from "@family-hub/contract";

import { fillForm, reatomSubmitFailure } from "@/common/form";

import type { CareApi } from "../care.api.ts";

type CareFormDependencies = {
  api: CareApi;
  petId: () => string | undefined;
  now: () => string;
  timeZone: () => string;
  onSaved: () => void;
};

const emptyEntry = {
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

type EntryValues = typeof emptyEntry;

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

function detailsOf(values: EntryValues): unknown {
  const kind = careKind.safeParse(values.kind);

  return kind.success ? detailsBuilders[kind.data](values) : undefined;
}

function changeOf(values: EntryValues, timeZone: string): CareEntryChange {
  return careEntryChange.parse({
    occurredAt: Temporal.PlainDateTime.from(values.occurredAt).toZonedDateTime(timeZone)
      .epochMilliseconds,
    note: values.note,
    details: detailsOf(values),
  });
}

const fieldOfIssue: Record<string, keyof EntryValues> = {
  vaccine: "name",
  target: "name",
  weightKg: "weightKg",
  amount: "amount",
  cost: "costAmount",
};

const messages: Partial<Record<keyof EntryValues, string>> = {
  name: "Заполните название",
  weightKg: "Вес в килограммах, с шагом 0,1",
  amount: "Сумма в целых рублях",
  costAmount: "Стоимость в целых рублях",
};

const fields = z.object({
  kind: z.string(),
  occurredAt: z.string(),
  note: z.string(),
  name: z.string(),
  product: z.string(),
  reason: z.string(),
  costAmount: z.string(),
  costCategory: z.string(),
  dueDate: z.string(),
  weightKg: z.string(),
  amount: z.string(),
  category: z.string(),
});

// The contract decides what a valid Care Entry is; the form only names the field to fix.
const schema = fields.superRefine((values, issues) => {
  const parsed = careEntryChange.shape.details.safeParse(detailsOf(values));

  if (values.occurredAt === "" || Number.isNaN(Date.parse(values.occurredAt))) {
    issues.addIssue({ code: "custom", path: ["occurredAt"], message: "Укажите дату и время" });
  }

  for (const issue of parsed.error?.issues ?? []) {
    const field = fieldOfIssue[String(issue.path[0])];

    if (field !== undefined) {
      issues.addIssue({ code: "custom", path: [field], message: messages[field] ?? "" });
    }
  }
});

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

function valuesOf(entry: CareEntry, timeZone: string): EntryValues {
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

export function reatomCareForm(dependencies: CareFormDependencies) {
  const editedId = atom<string | undefined>(undefined, "care.form.editedId");
  const form = reatomForm(emptyEntry, {
    name: "care.form",
    schema,
    onSubmit: async (values: EntryValues) => {
      const change = changeOf(values, dependencies.timeZone());
      const entryId = editedId();
      const petId = dependencies.petId();

      if (entryId !== undefined) {
        await wrap(dependencies.api.update(entryId, change));
      } else if (petId !== undefined) {
        await wrap(dependencies.api.create(petId, change));
      }

      dependencies.onSaved();
    },
  });

  return {
    form,
    editedId: computed(() => editedId(), "care.form.editedIdNow"),
    kind: computed(() => careKind.parse(form.fields.kind()), "care.form.kind"),
    isSaving: computed(() => !form.submit.ready(), "care.form.isSaving"),
    failure: reatomSubmitFailure(form, {
      message: "Не получилось сохранить запись. Попробуйте ещё раз.",
      name: "care.form.failure",
    }),

    startCreating: action((kind: CareKind) => {
      editedId.set(undefined);
      fillForm(form, { ...emptyEntry, kind, occurredAt: dependencies.now() });
    }, "care.form.startCreating"),
    startEditing: action((entry: CareEntry) => {
      editedId.set(entry.id);
      fillForm(form, valuesOf(entry, dependencies.timeZone()));
    }, "care.form.startEditing"),
    save: action(() => {
      form.submit().catch(noop);
    }, "care.form.save"),
  };
}

export type CareFormModel = ReturnType<typeof reatomCareForm>;
