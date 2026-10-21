import { action, atom, computed, noop, reatomForm, wrap, type Atom } from "@reatom/core";
import { z } from "zod";

import { careEntryChange, careKind, type CareEntry, type CareKind } from "@family-hub/contract";

import { fillForm, reatomSubmitFailure } from "@/common/form";

import type { CareApi } from "../care.api.ts";
import {
  changeOf,
  detailsOf,
  emptyEntry,
  valuesOf,
  type EntryValues,
} from "./care-form-values.vm.ts";
import type { EntryPhotosModel } from "./entry-photos.vm.ts";

type CareFormDependencies = {
  api: CareApi;
  petId: () => string | undefined;
  now: () => string;
  timeZone: () => string;
  photos: EntryPhotosModel;
  onSaved: () => void;
};

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

type EntryForm = ReturnType<typeof reatomForm<EntryValues>>;

function reatomStarts(
  dependencies: CareFormDependencies,
  { form, editedId }: { form: EntryForm; editedId: Atom<string | undefined> },
) {
  return {
    startCreating: action((kind: CareKind) => {
      editedId.set(undefined);
      dependencies.photos.reset([]);
      fillForm(form, { ...emptyEntry, kind, occurredAt: dependencies.now() });
    }, "care.form.startCreating"),
    // A due vaccination, treatment or visit is closed by recording the next one of the same name.
    startFollowUp: action((entry: CareEntry) => {
      const { kind, name } = valuesOf(entry, dependencies.timeZone());

      editedId.set(undefined);
      dependencies.photos.reset([]);
      fillForm(form, { ...emptyEntry, kind, name, occurredAt: dependencies.now() });
    }, "care.form.startFollowUp"),
    startEditing: action((entry: CareEntry) => {
      editedId.set(entry.id);
      dependencies.photos.reset(entry.photos);
      fillForm(form, valuesOf(entry, dependencies.timeZone()));
    }, "care.form.startEditing"),
  };
}

export function reatomCareForm(dependencies: CareFormDependencies) {
  const editedId = atom<string | undefined>(undefined, "care.form.editedId");
  const form = reatomForm(emptyEntry, {
    name: "care.form",
    schema,
    onSubmit: async (values: EntryValues) => {
      const change = {
        ...changeOf(values, dependencies.timeZone()),
        photoIds: dependencies.photos.photoIds(),
      };
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
    isSaving: computed(
      () => !form.submit.ready() || dependencies.photos.isUploading(),
      "care.form.isSaving",
    ),
    failure: reatomSubmitFailure(form, {
      message: "Не получилось сохранить запись. Попробуйте ещё раз.",
      name: "care.form.failure",
    }),

    ...reatomStarts(dependencies, { form, editedId }),

    save: action(() => {
      form.submit().catch(noop);
    }, "care.form.save"),
  };
}

export type CareFormModel = ReturnType<typeof reatomCareForm>;
