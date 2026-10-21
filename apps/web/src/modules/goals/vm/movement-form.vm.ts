import { action, atom, computed, noop, reatomForm, wrap, type Atom } from "@reatom/core";
import { z } from "zod";

import {
  movementChange,
  movementCommentMaxLength,
  type Goal,
  type MovementChange,
  type MovementKind,
} from "@family-hub/contract";

import { fillForm, reatomSubmitFailure } from "@/common/form";
import type { Choice } from "@/common/ui";

import type { GoalsApi } from "../goals.api.ts";
import type { GoalsModel } from "../goals.model.ts";

type MovementFormDependencies = {
  api: GoalsApi;
  goals: Pick<GoalsModel, "keep" | "members">;
  today: () => string;
  self: () => string | undefined;
  onSaved: (before: Goal, saved: Goal) => void;
};

type Editing = { goal: Goal; movementId: string | undefined };

const emptyMovement = { kind: "contribution", amount: "", date: "", memberId: "", comment: "" };

type MovementValues = typeof emptyMovement;

function schemaFor(today: () => string) {
  return z
    .object({
      kind: z.string(),
      amount: z.string().regex(/^[1-9]\d*$/u, "Целое число рублей больше нуля"),
      date: z.string().min(1, "Укажите дату"),
      memberId: z.string(),
      comment: z.string().max(movementCommentMaxLength, "Слишком длинно"),
    })
    .superRefine((values, issues) => {
      if (values.date > today()) {
        issues.addIssue({ code: "custom", path: ["date"], message: "Дата ещё не наступила" });
      }
    });
}

function changeOf(values: MovementValues): MovementChange {
  return movementChange.parse({
    ...values,
    amount: Number(values.amount),
    memberId: values.memberId === "" ? null : values.memberId,
  });
}

type MovementForm = ReturnType<typeof reatomForm<MovementValues>>;

function reatomMovementSubmit(
  { api, goals, onSaved, today }: MovementFormDependencies,
  editing: Atom<Editing | undefined>,
): MovementForm {
  return reatomForm(emptyMovement, {
    name: "goals.movementForm",
    schema: schemaFor(today),
    onSubmit: async (values: MovementValues) => {
      const target = editing();

      if (target === undefined) {
        return;
      }

      const { goal, movementId } = target;
      const change = changeOf(values);
      const saved = await wrap(
        movementId === undefined
          ? api.addMovement(goal.id, change)
          : api.updateMovement({ goalId: goal.id, movementId }, change),
      );

      goals.keep(saved);
      onSaved(goal, saved);
    },
  });
}

// A Private Goal takes only its owner's money, so it offers nobody else.
function reatomContributors(
  { goals, self }: MovementFormDependencies,
  editing: Atom<Editing | undefined>,
) {
  return computed((): Choice[] => {
    const members = goals.members.data() ?? [];
    const allowed =
      editing()?.goal.visibility === "private"
        ? members.filter(({ id }) => id === self())
        : members;

    return allowed.map(({ id, name }) => ({ value: id, title: name }));
  }, "goals.movementForm.contributors");
}

function valuesOf(movement: Goal["movements"][number]): MovementValues {
  return {
    kind: movement.kind,
    amount: String(movement.amount),
    date: movement.date,
    memberId: movement.member.id,
    comment: movement.comment ?? "",
  };
}

export function reatomMovementForm(dependencies: MovementFormDependencies) {
  const editing = atom<Editing | undefined>(undefined, "goals.movementForm.editing");
  const form = reatomMovementSubmit(dependencies, editing);

  return {
    form,
    isCreating: computed(
      () => editing()?.movementId === undefined,
      "goals.movementForm.isCreating",
    ),
    isSaving: computed(() => !form.submit.ready(), "goals.movementForm.isSaving"),
    contributors: reatomContributors(dependencies, editing),
    failure: reatomSubmitFailure(form, {
      message: "Не получилось сохранить. Баланс цели не может уйти в минус.",
      name: "goals.movementForm.failure",
    }),

    startAdding: action((goal: Goal, kind: MovementKind) => {
      editing.set({ goal, movementId: undefined });
      fillForm(form, {
        ...emptyMovement,
        kind,
        date: dependencies.today(),
        memberId: dependencies.self() ?? "",
      });
    }, "goals.movementForm.startAdding"),
    startEditing: action((goal: Goal, movementId: string) => {
      const movement = goal.movements.find(({ id }) => id === movementId);

      if (movement !== undefined) {
        editing.set({ goal, movementId });
        fillForm(form, valuesOf(movement));
      }
    }, "goals.movementForm.startEditing"),
    save: action(() => {
      form.submit().catch(noop);
    }, "goals.movementForm.save"),
  };
}

export type MovementFormModel = ReturnType<typeof reatomMovementForm>;
