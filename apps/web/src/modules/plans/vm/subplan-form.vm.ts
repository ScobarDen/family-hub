import { action, atom, computed, noop, reatomForm, wrap } from "@reatom/core";
import { z } from "zod";

import { planTitleMaxLength, type Plan, type SubplanChange } from "@family-hub/contract";

import { fillForm } from "@/common/form";

import type { PlansApi } from "../plans.api.ts";
import type { PlansModel } from "../plans.model.ts";
import { assigneeChoices } from "./plan-form.vm.ts";

type SubplanFormDependencies = {
  api: PlansApi;
  plans: Pick<PlansModel, "keep" | "members">;
  self: () => string | undefined;
  onSaved: (plan: Plan) => void;
};

type Editing = { plan: Plan; subplanId: string | undefined };

const emptySubplan = { title: "", dueDate: "", assigneeId: "" };

type SubplanValues = typeof emptySubplan;

const schema = z.object({
  title: z.string().trim().min(1, "Введите название").max(planTitleMaxLength, "Слишком длинно"),
  dueDate: z.string(),
  assigneeId: z.string(),
});

function changeOf(values: SubplanValues): SubplanChange {
  return {
    title: values.title.trim(),
    dueDate: values.dueDate === "" ? null : values.dueDate,
    assigneeId: values.assigneeId === "" ? null : values.assigneeId,
  };
}

function reatomSubplanForm({ api, plans, onSaved }: SubplanFormDependencies) {
  const editing = atom<Editing | undefined>(undefined, "plans.subplanForm.editing");
  const form = reatomForm(emptySubplan, {
    name: "plans.subplanForm",
    schema,
    onSubmit: async (values: SubplanValues) => {
      const target = editing();

      if (target === undefined) {
        return;
      }

      const { plan, subplanId } = target;
      const saved = await wrap(
        subplanId === undefined
          ? api.addSubplan(plan.id, changeOf(values))
          : api.updateSubplan({ planId: plan.id, subplanId }, changeOf(values)),
      );

      plans.keep(saved);
      onSaved(saved);
    },
  });

  return { form, editing };
}

export function reatomSubplanFormModel(dependencies: SubplanFormDependencies) {
  const { form, editing } = reatomSubplanForm(dependencies);

  return {
    form,
    isCreating: computed(() => editing()?.subplanId === undefined, "plans.subplanForm.isCreating"),
    isSaving: computed(() => !form.submit.ready(), "plans.subplanForm.isSaving"),
    assignees: computed(() => {
      const plan = editing()?.plan;

      return assigneeChoices(dependencies.plans.members.data() ?? [], {
        isPrivate: plan?.visibility === "private",
        ownerId: dependencies.self(),
      });
    }, "plans.subplanForm.assignees"),
    warning: computed((): string | undefined => {
      const planDueDate = editing()?.plan.dueDate ?? null;
      const dueDate = form.fields.dueDate();

      return planDueDate !== null && dueDate !== "" && dueDate > planDueDate
        ? "Позже срока плана"
        : undefined;
    }, "plans.subplanForm.warning"),

    startAdding: action((plan: Plan) => {
      editing.set({ plan, subplanId: undefined });
      fillForm(form, emptySubplan);
    }, "plans.subplanForm.startAdding"),
    startEditing: action((plan: Plan, subplanId: string) => {
      const subplan = plan.subplans.find(({ id }) => id === subplanId);

      editing.set({ plan, subplanId });
      fillForm(form, {
        title: subplan?.title ?? "",
        dueDate: subplan?.dueDate ?? "",
        assigneeId: subplan?.assignee?.id ?? "",
      });
    }, "plans.subplanForm.startEditing"),
    save: action(() => {
      form.submit().catch(noop);
    }, "plans.subplanForm.save"),
  };
}

export type SubplanFormModel = ReturnType<typeof reatomSubplanFormModel>;
