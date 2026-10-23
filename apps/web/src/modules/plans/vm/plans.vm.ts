import { action, atom, type Atom, type BooleanAtom, computed, reatomBoolean } from "@reatom/core";

import type { Plan } from "@family-hub/contract";

import type { Viewer } from "@/common/format-date";
import type { Dialogs } from "@/common/telegram";

import type { PlansApi } from "../plans.api.ts";
import { toDetails, toListItem, type PlanDetails, type PlanListItem } from "../plans.lib.ts";
import { reatomPlans, type PlansModel, type SharedLists } from "../plans.model.ts";
import { reatomPlanActions } from "./plan-actions.vm.ts";
import { reatomPlanFormModel } from "./plan-form.vm.ts";
import { reatomSubplanFormModel } from "./subplan-form.vm.ts";

export type PlansScreen =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "list"; open: PlanListItem[]; done: PlanListItem[]; isDoneShown: boolean }
  | { kind: "plan"; plan: PlanDetails }
  | { kind: "plan-form"; isCreating: boolean }
  | { kind: "subplan-form"; isCreating: boolean };

type PlansDependencies = {
  api: PlansApi;
  plans: PlansModel;
  telegram: Pick<Dialogs, "showPopup">;
  self: () => string | undefined;
  viewer: () => Viewer;
  onOpenAlbum: (albumId: string) => void;
};

type Navigation = {
  editing: Atom<"plan" | "subplan" | undefined>;
  openedPlanId: Atom<string | undefined>;
  isDoneShown: BooleanAtom;
};

type Forms = ReturnType<typeof reatomForms>;

function reatomForms(dependencies: PlansDependencies, { editing, openedPlanId }: Navigation) {
  function onSaved(saved: Plan): void {
    editing.set(undefined);
    openedPlanId.set(saved.id);
  }

  return {
    planForm: reatomPlanFormModel({ ...dependencies, onSaved }),
    subplanForm: reatomSubplanFormModel({ ...dependencies, onSaved }),
  };
}

function listScreen(
  plans: Plan[],
  { isDoneShown, today }: { isDoneShown: boolean; today: string },
): PlansScreen {
  return {
    kind: "list",
    open: plans
      .filter(({ completed }) => completed === null)
      .map((plan) => toListItem(plan, today)),
    done: plans
      .filter(({ completed }) => completed !== null)
      .map((plan) => toListItem(plan, today)),
    isDoneShown,
  };
}

function reatomScreen(
  dependencies: PlansDependencies,
  { editing, isDoneShown }: Navigation,
  { openedPlan, planForm, subplanForm }: Forms & { openedPlan: () => Plan | undefined },
) {
  return computed((): PlansScreen => {
    const current = editing();

    if (current === "plan") {
      return { kind: "plan-form", isCreating: planForm.isCreating() };
    }

    if (current === "subplan") {
      return { kind: "subplan-form", isCreating: subplanForm.isCreating() };
    }

    if (dependencies.plans.list.error() !== undefined) {
      return { kind: "failed" };
    }

    const plans = dependencies.plans.list.data();
    const plan = openedPlan();

    if (plans === undefined) {
      return { kind: "loading" };
    }

    return plan === undefined
      ? listScreen(plans, { isDoneShown: isDoneShown(), today: dependencies.viewer().today })
      : { kind: "plan", plan: toDetails(plan, dependencies.viewer()) };
  }, "plans.screen");
}

function reatomBrowsing({ editing, openedPlanId, isDoneShown }: Navigation) {
  return {
    open: action((planId: string) => {
      openedPlanId.set(planId);
    }, "plans.open"),
    toggleDone: action(() => {
      isDoneShown.toggle();
    }, "plans.toggleDone"),
    back: action(() => {
      if (editing() === undefined) {
        openedPlanId.set(undefined);
      } else {
        editing.set(undefined);
      }
    }, "plans.back"),
  };
}

function reatomEditing(
  { editing }: Navigation,
  { openedPlan, planForm, subplanForm }: Forms & { openedPlan: () => Plan | undefined },
) {
  function editWith(start: (plan: Plan) => void, target: "plan" | "subplan"): void {
    const plan = openedPlan();

    if (plan !== undefined) {
      start(plan);
      editing.set(target);
    }
  }

  return {
    add: action(() => {
      planForm.startCreating();
      editing.set("plan");
    }, "plans.add"),
    addForPet: action((petId: string) => {
      planForm.startCreating(petId);
      editing.set("plan");
    }, "plans.addForPet"),
    edit: action(() => {
      editWith(planForm.startEditing, "plan");
    }, "plans.edit"),
    addSubplan: action(() => {
      editWith(subplanForm.startAdding, "subplan");
    }, "plans.addSubplan"),
    editSubplan: action((subplanId: string) => {
      editWith((plan) => {
        subplanForm.startEditing(plan, subplanId);
      }, "subplan");
    }, "plans.editSubplan"),
  };
}

function titleOf(screen: PlansScreen): string {
  if (screen.kind === "plan") {
    return screen.plan.title;
  }

  if (screen.kind === "plan-form") {
    return screen.isCreating ? "Новый план" : "План";
  }

  return screen.kind === "subplan-form" ? "Шаг" : "Планы";
}

// The pet card shows its open Plans in «Скоро»; the plans module stays their only source.
function openPlansOf(plans: PlansModel) {
  return (petId: string) =>
    (plans.list.data() ?? []).filter(
      ({ pet, completed }) => pet?.id === petId && completed === null,
    );
}

export function reatomPlansScreen(input: Omit<PlansDependencies, "plans"> & SharedLists) {
  const dependencies: PlansDependencies = { ...input, plans: reatomPlans(input) };
  const navigation: Navigation = {
    editing: atom<"plan" | "subplan" | undefined>(undefined, "plans.editing"),
    openedPlanId: atom<string | undefined>(undefined, "plans.openedPlanId"),
    isDoneShown: reatomBoolean(false, "plans.isDoneShown"),
  };
  const openedPlan = computed(
    () => dependencies.plans.list.data()?.find(({ id }) => id === navigation.openedPlanId()),
    "plans.openedPlan",
  );
  const forms = reatomForms(dependencies, navigation);
  const actions = reatomPlanActions({
    ...dependencies,
    openedPlan,
    onDeleted: () => {
      navigation.openedPlanId.set(undefined);
    },
  });

  const screen = reatomScreen(dependencies, navigation, { ...forms, openedPlan });

  return {
    screen,
    title: computed(() => titleOf(screen()), "plans.title"),
    retry: dependencies.plans.reload,
    openPlansOf: openPlansOf(dependencies.plans),
    canGoBack: computed(
      () => navigation.editing() !== undefined || openedPlan() !== undefined,
      "plans.canGoBack",
    ),
    ...forms,
    ...actions,
    ...reatomBrowsing(navigation),
    openAlbum: action((albumId: string) => {
      dependencies.onOpenAlbum(albumId);
    }, "plans.openAlbum"),
    ...reatomEditing(navigation, { ...forms, openedPlan }),
  };
}

export type PlansScreenModel = ReturnType<typeof reatomPlansScreen>;
