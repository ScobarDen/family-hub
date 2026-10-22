import { action, computed, reatomForm } from "@reatom/core";
import { z } from "zod";

import {
  planNoteMaxLength,
  planTitleMaxLength,
  visibility,
  type Plan,
  type PlanChange,
} from "@family-hub/contract";

import { reatomEditableRecord } from "@/common/form";
import type { Choice } from "@/common/ui";

import type { PlansApi } from "../plans.api.ts";
import { reminderOf, reminderValueOf } from "../plans.lib.ts";
import type { PlansModel } from "../plans.model.ts";

type PlanFormDependencies = {
  api: PlansApi;
  plans: Pick<PlansModel, "keep" | "members" | "pets" | "albums">;
  self: () => string | undefined;
  onSaved: (plan: Plan) => void;
};

const emptyPlan = {
  title: "",
  note: "",
  dueDate: "",
  reminder: "",
  assigneeId: "",
  visibility: "shared",
  petId: "",
  albumId: "",
};

type PlanValues = typeof emptyPlan;

const schema = z.object({
  title: z.string().trim().min(1, "Введите название").max(planTitleMaxLength, "Слишком длинно"),
  note: z.string().max(planNoteMaxLength, `Не длиннее ${planNoteMaxLength} символов`),
  dueDate: z.string(),
  reminder: z.string(),
  assigneeId: z.string(),
  visibility: z.string(),
  petId: z.string(),
  albumId: z.string(),
});

function linksOf({
  assignee,
  pet,
  album,
}: Plan): Pick<PlanValues, "assigneeId" | "petId" | "albumId"> {
  return { assigneeId: assignee?.id ?? "", petId: pet?.id ?? "", albumId: album?.id ?? "" };
}

function valuesOf(plan: Plan): PlanValues {
  return {
    title: plan.title,
    note: plan.note ?? "",
    dueDate: plan.dueDate ?? "",
    reminder: reminderValueOf(plan.reminder),
    visibility: plan.visibility,
    ...linksOf(plan),
  };
}

function changeOf(values: PlanValues): PlanChange {
  return {
    title: values.title.trim(),
    note: values.note.trim() === "" ? null : values.note.trim(),
    dueDate: values.dueDate === "" ? null : values.dueDate,
    reminder: reminderOf(values),
    assigneeId: values.assigneeId === "" ? null : values.assigneeId,
    visibility: visibility.parse(values.visibility),
    petId: values.petId === "" ? null : values.petId,
    albumId: values.albumId === "" ? null : values.albumId,
  };
}

export function assigneeChoices(
  members: Array<{ id: string; name: string }>,
  { isPrivate, ownerId }: { isPrivate: boolean; ownerId: string | undefined },
): Choice[] {
  const allowed = isPrivate ? members.filter(({ id }) => id === ownerId) : members;

  return [
    { value: "", title: "Никто" },
    ...allowed.map(({ id, name }) => ({ value: id, title: name })),
  ];
}

function reatomPlanRecord({ api, plans, onSaved }: PlanFormDependencies) {
  return reatomEditableRecord({
    name: "plans.planRecord",
    form: (onSubmit) => reatomForm(emptyPlan, { name: "plans.planForm", schema, onSubmit }),
    failureMessage: "Не получилось сохранить план. Попробуйте ещё раз.",
    valuesOf,
    create: async (values) => api.create(changeOf(values)),
    update: async (plan: Plan, values) => api.update(plan.id, changeOf(values)),
    onSaved: (saved) => {
      plans.keep(saved);
      onSaved(saved);
    },
  });
}

type PlanRecord = ReturnType<typeof reatomPlanRecord>;

// A trip's Plan keeps its photos in one of the Family's own Albums, not a Pet's.
// Only the «none» choice left means there is nothing to choose, so the field stays hidden.
function hasChoice(choices: () => Choice[], name: string) {
  return computed(() => choices().length > 1, name);
}

function reatomPetChoices({ plans }: PlanFormDependencies) {
  return computed(
    (): Choice[] => [
      { value: "", title: "Без питомца" },
      ...(plans.pets.data() ?? [])
        .filter(({ archivedAt }) => archivedAt === null)
        .map(({ id, name }) => ({ value: id, title: name })),
    ],
    "plans.planForm.pets",
  );
}

function reatomAlbumChoices({ plans }: PlanFormDependencies) {
  return computed(
    (): Choice[] => [
      { value: "", title: "Без альбома" },
      ...(plans.albums.data() ?? [])
        .filter(({ kind }) => kind === "album")
        .map(({ id, title }) => ({ value: id, title })),
    ],
    "plans.planForm.albums",
  );
}

function reatomChoices(dependencies: PlanFormDependencies, { form, edited }: PlanRecord) {
  const isPrivate = computed(
    () => form.fields.visibility() === "private",
    "plans.planForm.isPrivate",
  );
  const pets = reatomPetChoices(dependencies);
  const albums = reatomAlbumChoices(dependencies);

  return {
    // A Shared Plan never turns Private, so editing one offers no choice.
    canChooseVisibility: computed(
      () => edited()?.visibility !== "shared",
      "plans.planForm.canChooseVisibility",
    ),
    assignees: computed(
      () =>
        assigneeChoices(dependencies.plans.members.data() ?? [], {
          isPrivate: isPrivate(),
          ownerId: dependencies.self(),
        }),
      "plans.planForm.assignees",
    ),
    pets,
    hasPetChoice: hasChoice(pets, "plans.planForm.hasPetChoice"),
    albums,
    hasAlbumChoice: hasChoice(albums, "plans.planForm.hasAlbumChoice"),
  };
}

export function reatomPlanFormModel(dependencies: PlanFormDependencies) {
  const record = reatomPlanRecord(dependencies);
  const { form } = record;

  return {
    ...record,
    ...reatomChoices(dependencies, record),

    chooseVisibility: action((chosen: string) => {
      form.fields.visibility.set(chosen);

      if (chosen === "private" && form.fields.assigneeId() !== dependencies.self()) {
        form.fields.assigneeId.set("");
      }
    }, "plans.planForm.chooseVisibility"),
    startCreating: action((petId?: string) => {
      record.startCreating({ ...emptyPlan, petId: petId ?? "" });
    }, "plans.planForm.startCreating"),
  };
}

export type PlanFormModel = ReturnType<typeof reatomPlanFormModel>;
