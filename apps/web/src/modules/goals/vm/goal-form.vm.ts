import { action, computed, reatomForm } from "@reatom/core";
import { z } from "zod";

import {
  goalChange,
  goalNoteMaxLength,
  goalTitleMaxLength,
  type Goal,
  type GoalChange,
} from "@family-hub/contract";

import { reatomEditableRecord } from "@/common/form";

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

export function reatomGoalForm({ api, goals, onSaved }: GoalFormDependencies) {
  const record = reatomEditableRecord({
    name: "goals.record",
    form: (onSubmit) => reatomForm(emptyGoal, { name: "goals.form", schema, onSubmit }),
    failureMessage: "Не получилось сохранить цель. Попробуйте ещё раз.",
    valuesOf,
    create: async (values) => api.create(changeOf(values)),
    update: async (goal: Goal, values) => api.update(goal.id, changeOf(values)),
    onSaved: (saved) => {
      goals.keep(saved);
      onSaved(saved);
    },
  });

  return {
    ...record,
    // A Shared Goal never turns Private, so editing one offers no choice.
    canChooseVisibility: computed(
      () => record.edited()?.visibility !== "shared",
      "goals.form.canChooseVisibility",
    ),
    startCreating: action(() => {
      record.startCreating(emptyGoal);
    }, "goals.form.startCreating"),
  };
}

export type GoalFormModel = ReturnType<typeof reatomGoalForm>;
