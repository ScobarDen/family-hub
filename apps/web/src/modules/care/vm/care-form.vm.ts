import { action, computed, reatomForm } from "@reatom/core";
import { z } from "zod";

import {
  careEntryChange,
  careKind,
  type CareEntry,
  type CareEntryChange,
  type CareEntryDraft,
  type CareKind,
} from "@family-hub/contract";

import { reatomEditableRecord, type DraftOpening } from "@/common/form";
import type { PhotoAttachmentsModel } from "@/common/photo-attachments";

import type { CareApi } from "../care.api.ts";
import { kindFields } from "../care.config.ts";
import {
  changeOf,
  detailsOf,
  emptyEntry,
  valuesOf,
  valuesOfDraft,
  type EntryValues,
} from "./care-form-values.vm.ts";

type CareFormDependencies = {
  api: CareApi;
  petId: () => string | undefined;
  now: () => string;
  timeZone: () => string;
  photos: PhotoAttachmentsModel;
  onSaved: () => void;
  // An entry saved from a Command Draft settles that draft.
  onDraftSaved: (draftId: string) => void;
};

export type CareEntryDraftOpening = DraftOpening<CareEntryDraft>;

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

type CareRecord = ReturnType<typeof reatomCareRecord>;

function reatomStarts({ now, timeZone, photos }: CareFormDependencies, record: CareRecord) {
  return {
    startCreating: action((kind: CareKind) => {
      photos.reset([]);
      record.startCreating({ ...emptyEntry, kind, occurredAt: now() });
    }, "care.form.startCreating"),
    // A due vaccination, treatment or visit is closed by recording the next one of the same name.
    startFollowUp: action((entry: CareEntry) => {
      const { kind, name } = valuesOf(entry, timeZone());

      photos.reset([]);
      record.startCreating({ ...emptyEntry, kind, name, occurredAt: now() });
    }, "care.form.startFollowUp"),
    // Photos never come by voice; the form is where they are added.
    startFromDraft: action((opening: CareEntryDraftOpening) => {
      photos.reset([]);
      record.startFromDraft(opening);
    }, "care.form.startFromDraft"),
    startEditing: action((entry: CareEntry) => {
      photos.reset(entry.photos);
      record.startEditing(entry);
    }, "care.form.startEditing"),
  };
}

function reatomCareRecord(dependencies: CareFormDependencies) {
  const { api, petId, timeZone, photos } = dependencies;

  function changeFor(values: EntryValues): CareEntryChange {
    return { ...changeOf(values, timeZone()), photoIds: photos.photoIds() };
  }

  return reatomEditableRecord({
    name: "care.record",
    form: (onSubmit) => reatomForm(emptyEntry, { name: "care.form", schema, onSubmit }),
    failureMessage: "Не получилось сохранить запись. Попробуйте ещё раз.",
    valuesOf: (entry: CareEntry) => valuesOf(entry, timeZone()),
    valuesOfDraft: (draft: CareEntryDraft, phrase) =>
      valuesOfDraft(draft, { phrase, timeZone: timeZone() }),
    create: async (values) => {
      const pet = petId();

      if (pet === undefined) {
        throw new Error("No Pet is open to write the Care Entry to");
      }

      return api.create(pet, changeFor(values));
    },
    update: async (entry: CareEntry, values) => api.update(entry.id, changeFor(values)),
    onSaved: dependencies.onSaved,
    onDraftSaved: dependencies.onDraftSaved,
  });
}

export function reatomCareForm(dependencies: CareFormDependencies) {
  const record = reatomCareRecord(dependencies);

  const kind = computed(() => careKind.parse(record.form.fields.kind()), "care.form.kind");

  return {
    ...record,
    editedId: computed(() => record.edited()?.id, "care.form.editedId"),
    kind,
    kindFields: computed(() => kindFields[kind()], "care.form.kindFields"),
    isSaving: computed(
      () => record.isSaving() || dependencies.photos.isUploading(),
      "care.form.isSaving",
    ),
    ...reatomStarts(dependencies, record),
  };
}

export type CareFormModel = ReturnType<typeof reatomCareForm>;
