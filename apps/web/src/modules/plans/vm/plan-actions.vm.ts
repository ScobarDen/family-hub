import { action, computed, noop, withAsync, wrap } from "@reatom/core";

import type { Plan } from "@family-hub/contract";

import { reatomFailure } from "@/common/state";
import { type Dialogs, isConfirmed } from "@/common/telegram";

import type { PlansApi } from "../plans.api.ts";
import type { PlansModel } from "../plans.model.ts";

export type PlanActionsDependencies = {
  api: PlansApi;
  plans: Pick<PlansModel, "keep" | "drop" | "list">;
  telegram: Pick<Dialogs, "showPopup">;
  openedPlan: () => Plan | undefined;
  onDeleted: () => void;
};

async function togglePlan(
  dependencies: PlanActionsDependencies,
  plan: Plan,
): Promise<Plan | undefined> {
  const { api } = dependencies;

  if (plan.completed !== null) {
    return api.reopen(plan.id);
  }

  const openCount = plan.subplans.filter(({ completed }) => completed === null).length;
  const isSure =
    openCount === 0 ||
    (await wrap(
      isConfirmed(dependencies.telegram, {
        title: "Завершить план?",
        message: `Открытые шаги (${openCount}) тоже будут отмечены выполненными.`,
        button: "Завершить",
        isDestructive: false,
      }),
    ));

  return isSure ? api.complete(plan.id) : undefined;
}

async function toggleSubplan({ api }: PlanActionsDependencies, plan: Plan, subplanId: string) {
  const subplan = plan.subplans.find(({ id }) => id === subplanId);
  const target = { planId: plan.id, subplanId };

  return subplan?.completed === null ? api.completeSubplan(target) : api.reopenSubplan(target);
}

async function removeSubplan(dependencies: PlanActionsDependencies, plan: Plan, subplanId: string) {
  const isSure = await wrap(
    isConfirmed(dependencies.telegram, {
      title: "Удалить шаг?",
      message: "Шаг пропадёт из плана у всей семьи.",
      button: "Удалить",
    }),
  );

  return isSure ? dependencies.api.removeSubplan({ planId: plan.id, subplanId }) : undefined;
}

async function removePlan(dependencies: PlanActionsDependencies, plan: Plan): Promise<void> {
  const isSure = await wrap(
    isConfirmed(dependencies.telegram, {
      title: "Удалить план?",
      message: "План и все его шаги пропадут у всей семьи.",
      button: "Удалить",
    }),
  );

  if (isSure) {
    await wrap(dependencies.api.remove(plan.id));
    dependencies.plans.drop(plan.id);
    dependencies.onDeleted();
  }
}

async function kept(
  { plans }: PlanActionsDependencies,
  saving: Promise<Plan | undefined>,
): Promise<void> {
  const saved = await wrap(saving);

  if (saved !== undefined) {
    plans.keep(saved);
  }
}

// A change works on the opened Plan, or on one named from the list.
function reatomPlanChange(dependencies: PlanActionsDependencies) {
  return action(async (change: (plan: Plan) => Promise<void>, planId?: string) => {
    const plan =
      planId === undefined
        ? dependencies.openedPlan()
        : dependencies.plans.list.data()?.find(({ id }) => id === planId);

    if (plan === undefined) {
      return;
    }

    await wrap(change(plan));
  }, "plans.change").extend(withAsync());
}

export function reatomPlanActions(dependencies: PlanActionsDependencies) {
  const change = reatomPlanChange(dependencies);

  return {
    failure: reatomFailure(change, {
      message: "Не получилось сохранить. Попробуйте ещё раз.",
      name: "plans.failure",
    }),
    isChanging: computed(() => !change.ready(), "plans.isChanging"),

    togglePlan: action(() => {
      change(async (plan) => kept(dependencies, togglePlan(dependencies, plan))).catch(noop);
    }, "plans.togglePlan"),
    togglePlanOf: action((planId: string) => {
      change(async (plan) => kept(dependencies, togglePlan(dependencies, plan)), planId).catch(
        noop,
      );
    }, "plans.togglePlanOf"),
    toggleSubplan: action((subplanId: string) => {
      change(async (plan) =>
        kept(dependencies, toggleSubplan(dependencies, plan, subplanId)),
      ).catch(noop);
    }, "plans.toggleSubplan"),
    removeSubplan: action((subplanId: string) => {
      change(async (plan) =>
        kept(dependencies, removeSubplan(dependencies, plan, subplanId)),
      ).catch(noop);
    }, "plans.removeSubplan"),
    removePlan: action(() => {
      change(async (plan) => removePlan(dependencies, plan)).catch(noop);
    }, "plans.removePlan"),
  };
}
