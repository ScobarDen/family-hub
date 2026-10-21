import { action, atom, computed, noop, withAsync, wrap, type Atom } from "@reatom/core";

import type { Plan } from "@family-hub/contract";

import type { PopupParams } from "@/common/telegram";

import type { PlansApi } from "../plans.api.ts";
import type { PlansModel } from "../plans.model.ts";

export type PlanActionsDependencies = {
  api: PlansApi;
  plans: Pick<PlansModel, "keep" | "drop">;
  telegram: { showPopup: (params: PopupParams) => Promise<string | undefined> };
  openedPlan: () => Plan | undefined;
  onDeleted: () => void;
};

type Confirmation = { title: string; message: string; button: string };

async function isConfirmed(
  { telegram }: PlanActionsDependencies,
  { title, message, button }: Confirmation,
): Promise<boolean> {
  const choice = await wrap(
    telegram.showPopup({
      title,
      message,
      buttons: [
        { id: "confirm", type: "default", text: button },
        { id: "cancel", type: "cancel" },
      ],
    }),
  );

  return choice === "confirm";
}

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
      isConfirmed(dependencies, {
        title: "Завершить план?",
        message: `Открытые шаги (${openCount}) тоже будут отмечены выполненными.`,
        button: "Завершить",
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
    isConfirmed(dependencies, {
      title: "Удалить шаг?",
      message: "Шаг пропадёт из плана у всей семьи.",
      button: "Удалить",
    }),
  );

  return isSure ? dependencies.api.removeSubplan({ planId: plan.id, subplanId }) : undefined;
}

async function removePlan(dependencies: PlanActionsDependencies, plan: Plan): Promise<void> {
  const isSure = await wrap(
    isConfirmed(dependencies, {
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

function reatomPlanChange(
  dependencies: PlanActionsDependencies,
  failure: Atom<string | undefined>,
) {
  return action(async (change: (plan: Plan) => Promise<void>) => {
    const plan = dependencies.openedPlan();

    if (plan === undefined) {
      return;
    }

    failure.set(undefined);

    try {
      await wrap(change(plan));
    } catch {
      failure.set("Не получилось сохранить. Попробуйте ещё раз.");
    }
  }, "plans.change").extend(withAsync());
}

export function reatomPlanActions(dependencies: PlanActionsDependencies) {
  const failure = atom<string | undefined>(undefined, "plans.failure");
  const change = reatomPlanChange(dependencies, failure);

  return {
    failure: computed(() => failure(), "plans.visibleFailure"),
    isChanging: computed(() => !change.ready(), "plans.isChanging"),

    togglePlan: action(() => {
      change(async (plan) => kept(dependencies, togglePlan(dependencies, plan))).catch(noop);
    }, "plans.togglePlan"),
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

export type PlanActions = ReturnType<typeof reatomPlanActions>;
