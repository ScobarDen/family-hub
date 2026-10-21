import { action, atom, computed, noop, reatomForm, wrap, type Atom } from "@reatom/core";
import { z } from "zod";

import {
  goalChange,
  goalNoteMaxLength,
  goalTitleMaxLength,
  type Goal,
  type GoalChange,
} from "@family-hub/contract";

import { fillForm, reatomSubmitFailure } from "@/common/form";

import type { GoalsApi } from "../goals.api.ts";
import type { GoalsModel } from "../goals.model.ts";

type GoalFormDependencies = {
  api: GoalsApi;
  goals: Pick<GoalsModel, "keep">;
  onSaved: (goal: Goal) => void;
};

const emptyGoal = {
  title: "",
  target: "",
  deadline: "",
  icon: "piggy-bank",
  color: "teal",
  note: "",
  visibility: "shared",
};

type GoalValues = typeof emptyGoal;

const schema = z.object({
  title: z.string().trim().min(1, "Введите название").max(goalTitleMaxLength, "Слишком длинно"),
  target: z.string().regex(/^[1-9]\d*$/u, "Целое число рублей больше нуля"),
  deadline: z.string(),
  icon: z.string(),
  color: z.string(),
  note: z.string().max(goalNoteMaxLength, `Не длиннее ${goalNoteMaxLength} символов`),
  visibility: z.string(),
});

function changeOf(values: GoalValues): GoalChange {
  return goalChange.parse({
    ...values,
    target: Number(values.target),
    deadline: values.deadline === "" ? null : values.deadline,
  });
}

function valuesOf(goal: Goal): GoalValues {
  return {
    title: goal.title,
    target: String(goal.target),
    deadline: goal.deadline ?? "",
    icon: goal.icon,
    color: goal.color,
    note: goal.note ?? "",
    visibility: goal.visibility,
  };
}

type GoalForm = ReturnType<typeof reatomForm<GoalValues>>;

function reatomFlags(form: GoalForm, edited: Atom<Goal | undefined>) {
  return {
    // A Shared Goal never turns Private, so editing one offers no choice.
    canChooseVisibility: computed(
      () => edited()?.visibility !== "shared",
      "goals.form.canChooseVisibility",
    ),
    failure: reatomSubmitFailure(form, {
      message: "Не получилось сохранить цель. Попробуйте ещё раз.",
      name: "goals.form.failure",
    }),
  };
}

export function reatomGoalForm({ api, goals, onSaved }: GoalFormDependencies) {
  const edited = atom<Goal | undefined>(undefined, "goals.form.edited");
  const form = reatomForm(emptyGoal, {
    name: "goals.form",
    schema,
    onSubmit: async (values: GoalValues) => {
      const goal = edited();
      const change = changeOf(values);
      const saved = await wrap(
        goal === undefined ? api.create(change) : api.update(goal.id, change),
      );

      goals.keep(saved);
      onSaved(saved);
    },
  });

  return {
    form,
    isCreating: computed(() => edited() === undefined, "goals.form.isCreating"),
    isSaving: computed(() => !form.submit.ready(), "goals.form.isSaving"),
    ...reatomFlags(form, edited),

    startCreating: action(() => {
      edited.set(undefined);
      fillForm(form, emptyGoal);
    }, "goals.form.startCreating"),
    startEditing: action((goal: Goal) => {
      edited.set(goal);
      fillForm(form, valuesOf(goal));
    }, "goals.form.startEditing"),
    save: action(() => {
      form.submit().catch(noop);
    }, "goals.form.save"),
  };
}

export type GoalFormModel = ReturnType<typeof reatomGoalForm>;
