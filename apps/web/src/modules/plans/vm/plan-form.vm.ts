import { action, atom, computed, noop, reatomForm, wrap } from "@reatom/core";
import { z } from "zod";

import {
  planNoteMaxLength,
  planTitleMaxLength,
  visibility,
  type Plan,
  type PlanChange,
} from "@family-hub/contract";

import { fillForm, reatomSubmitFailure } from "@/common/form";
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

function reatomPlanForm({ api, plans, onSaved }: PlanFormDependencies) {
  const editedPlan = atom<Plan | undefined>(undefined, "plans.planForm.editedPlan");
  const form = reatomForm(emptyPlan, {
    name: "plans.planForm",
    schema,
    onSubmit: async (values: PlanValues) => {
      const plan = editedPlan();
      const saved = await wrap(
        plan === undefined ? api.create(changeOf(values)) : api.update(plan.id, changeOf(values)),
      );

      plans.keep(saved);
      onSaved(saved);
    },
  });

  return { form, editedPlan };
}

// A trip's Plan keeps its photos in one of the Family's own Albums, not a Pet's.
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

function reatomChoices(
  dependencies: PlanFormDependencies,
  { form, editedPlan }: ReturnType<typeof reatomPlanForm>,
) {
  const isPrivate = computed(
    () => form.fields.visibility() === "private",
    "plans.planForm.isPrivate",
  );

  return {
    // A Shared Plan never turns Private, so editing one offers no choice.
    canChooseVisibility: computed(
      () => editedPlan()?.visibility !== "shared",
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
    pets: computed(
      (): Choice[] => [
        { value: "", title: "Без питомца" },
        ...(dependencies.plans.pets.data() ?? [])
          .filter(({ archivedAt }) => archivedAt === null)
          .map(({ id, name }) => ({ value: id, title: name })),
      ],
      "plans.planForm.pets",
    ),
    albums: reatomAlbumChoices(dependencies),
  };
}

export function reatomPlanFormModel(dependencies: PlanFormDependencies) {
  const { form, editedPlan } = reatomPlanForm(dependencies);

  return {
    form,
    isCreating: computed(() => editedPlan() === undefined, "plans.planForm.isCreating"),
    isSaving: computed(() => !form.submit.ready(), "plans.planForm.isSaving"),
    ...reatomChoices(dependencies, { form, editedPlan }),
    failure: reatomSubmitFailure(form, {
      message: "Не получилось сохранить план. Попробуйте ещё раз.",
      name: "plans.planForm.failure",
    }),

    chooseVisibility: action((chosen: string) => {
      form.fields.visibility.set(chosen);

      if (chosen === "private" && form.fields.assigneeId() !== dependencies.self()) {
        form.fields.assigneeId.set("");
      }
    }, "plans.planForm.chooseVisibility"),
    startCreating: action((petId?: string) => {
      editedPlan.set(undefined);
      fillForm(form, { ...emptyPlan, petId: petId ?? "" });
    }, "plans.planForm.startCreating"),
    startEditing: action((plan: Plan) => {
      editedPlan.set(plan);
      fillForm(form, valuesOf(plan));
    }, "plans.planForm.startEditing"),
    save: action(() => {
      form.submit().catch(noop);
    }, "plans.planForm.save"),
  };
}

export type PlanFormModel = ReturnType<typeof reatomPlanFormModel>;
