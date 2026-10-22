import { action, atom, computed, reatomForm, type Atom } from "@reatom/core";
import { z } from "zod";

import {
  planTitleMaxLength,
  type Plan,
  type Subplan,
  type SubplanChange,
} from "@family-hub/contract";

import { reatomEditableRecord } from "@/common/form";

import type { PlansApi } from "../plans.api.ts";
import { reminderOf, reminderValueOf } from "../plans.lib.ts";
import type { PlansModel } from "../plans.model.ts";
import { assigneeChoices } from "./plan-form.vm.ts";

type SubplanFormDependencies = {
  api: PlansApi;
  plans: Pick<PlansModel, "keep" | "members">;
  self: () => string | undefined;
  onSaved: (plan: Plan) => void;
};

type Edited = { plan: Plan; subplanId: string };

const emptySubplan = { title: "", dueDate: "", reminder: "", assigneeId: "" };

type SubplanValues = typeof emptySubplan;

const schema = z.object({
  title: z.string().trim().min(1, "Введите название").max(planTitleMaxLength, "Слишком длинно"),
  dueDate: z.string(),
  reminder: z.string(),
  assigneeId: z.string(),
});

function valuesOf({ plan, subplanId }: Edited): SubplanValues {
  const subplan = plan.subplans.find(({ id }) => id === subplanId);

  return subplan === undefined ? emptySubplan : subplanValuesOf(subplan);
}

function subplanValuesOf(subplan: Subplan): SubplanValues {
  return {
    title: subplan.title,
    dueDate: subplan.dueDate ?? "",
    reminder: reminderValueOf(subplan.reminder),
    assigneeId: subplan.assignee?.id ?? "",
  };
}

function changeOf(values: SubplanValues): SubplanChange {
  return {
    title: values.title.trim(),
    dueDate: values.dueDate === "" ? null : values.dueDate,
    reminder: reminderOf(values),
    assigneeId: values.assigneeId === "" ? null : values.assigneeId,
  };
}

function reatomSubplanRecord(
  { api, plans, onSaved }: SubplanFormDependencies,
  plan: Atom<Plan | undefined>,
) {
  return reatomEditableRecord({
    name: "plans.subplanRecord",
    form: (onSubmit) => reatomForm(emptySubplan, { name: "plans.subplanForm", schema, onSubmit }),
    failureMessage: "Не получилось сохранить шаг. Попробуйте ещё раз.",
    valuesOf,
    create: async (values) => {
      const target = plan();

      if (target === undefined) {
        throw new Error("No Plan is open to add the subplan to");
      }

      return api.addSubplan(target.id, changeOf(values));
    },
    update: async ({ plan: target, subplanId }: Edited, values) =>
      api.updateSubplan({ planId: target.id, subplanId }, changeOf(values)),
    onSaved: (saved) => {
      plans.keep(saved);
      onSaved(saved);
    },
  });
}

export function reatomSubplanFormModel(dependencies: SubplanFormDependencies) {
  const plan = atom<Plan | undefined>(undefined, "plans.subplanForm.plan");
  const { startCreating, startEditing, ...record } = reatomSubplanRecord(dependencies, plan);
  const { form } = record;

  return {
    ...record,
    assignees: computed(
      () =>
        assigneeChoices(dependencies.plans.members.data() ?? [], {
          isPrivate: plan()?.visibility === "private",
          ownerId: dependencies.self(),
        }),
      "plans.subplanForm.assignees",
    ),
    warning: computed((): string | undefined => {
      const planDueDate = plan()?.dueDate ?? null;
      const dueDate = form.fields.dueDate();

      return planDueDate !== null && dueDate !== "" && dueDate > planDueDate
        ? "Позже срока плана"
        : undefined;
    }, "plans.subplanForm.warning"),

    startAdding: action((target: Plan) => {
      plan.set(target);
      startCreating(emptySubplan);
    }, "plans.subplanForm.startAdding"),
    startEditing: action((target: Plan, subplanId: string) => {
      plan.set(target);
      startEditing({ plan: target, subplanId });
    }, "plans.subplanForm.startEditing"),
  };
}

export type SubplanFormModel = ReturnType<typeof reatomSubplanFormModel>;
