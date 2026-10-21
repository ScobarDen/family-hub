import { action, atom, computed, noop, withAsync, wrap, type Atom } from "@reatom/core";

import type { Goal, GoalOutcome, MovementKind } from "@family-hub/contract";

import { formatRubles } from "@/common/format-money";
import type { PopupParams } from "@/common/telegram";

import type { GoalsApi } from "../goals.api.ts";
import { sectionsOf, toDetails, type GoalDetails, type GoalSections } from "../goals.lib.ts";
import type { GoalsModel } from "../goals.model.ts";
import { reatomGoalForm } from "./goal-form.vm.ts";
import { reatomMovementForm } from "./movement-form.vm.ts";

export type GoalsScreen =
  | { kind: "loading" }
  | { kind: "failed" }
  | ({ kind: "list"; total: string } & GoalSections)
  | { kind: "goal"; goal: GoalDetails; isCelebrating: boolean }
  | { kind: "goal-form"; isCreating: boolean }
  | { kind: "movement-form"; isCreating: boolean; isWithdrawal: boolean };

type GoalsDependencies = {
  api: GoalsApi;
  goals: GoalsModel;
  telegram: { showPopup: (params: PopupParams) => Promise<string | undefined> };
  self: () => string | undefined;
  today: () => string;
  timeZone: () => string;
};

type Navigation = {
  editing: Atom<"goal" | "movement" | undefined>;
  openedGoalId: Atom<string | undefined>;
  isCelebrating: Atom<boolean>;
};

const outcomeQuestions: Record<GoalOutcome, PopupParams> = {
  fulfilled: {
    title: "Цель исполнена?",
    message: "Цель уйдёт в архив и больше не будет меняться.",
    buttons: [
      { id: "confirm", type: "default", text: "Исполнена" },
      { id: "cancel", type: "cancel" },
    ],
  },
  cancelled: {
    title: "Отменить цель?",
    message: "Цель уйдёт в архив с тем, что на ней накоплено, и больше не будет меняться.",
    buttons: [
      { id: "confirm", type: "destructive", text: "Отменить цель" },
      { id: "cancel", type: "cancel" },
    ],
  },
};

function reatomForms(dependencies: GoalsDependencies, navigation: Navigation) {
  const { editing, openedGoalId, isCelebrating } = navigation;

  return {
    goalForm: reatomGoalForm({
      ...dependencies,
      onSaved: (saved) => {
        editing.set(undefined);
        openedGoalId.set(saved.id);
      },
    }),
    // Reaching the target with this very movement sets off the salute.
    movementForm: reatomMovementForm({
      ...dependencies,
      onSaved: (before, saved) => {
        editing.set(undefined);
        isCelebrating.set(!before.isAchieved && saved.isAchieved);
      },
    }),
  };
}

type Forms = ReturnType<typeof reatomForms>;

function reatomScreen(
  dependencies: GoalsDependencies,
  navigation: Navigation,
  { openedGoal, goalForm, movementForm }: Forms & { openedGoal: () => Goal | undefined },
) {
  return computed((): GoalsScreen => {
    const current = navigation.editing();

    if (current === "goal") {
      return { kind: "goal-form", isCreating: goalForm.isCreating() };
    }

    if (current === "movement") {
      return {
        kind: "movement-form",
        isCreating: movementForm.isCreating(),
        isWithdrawal: movementForm.form.fields.kind() === "withdrawal",
      };
    }

    const list = dependencies.goals.list.data();
    const goal = openedGoal();

    if (list === undefined) {
      return dependencies.goals.list.error() === undefined
        ? { kind: "loading" }
        : { kind: "failed" };
    }

    return goal === undefined
      ? { kind: "list", total: formatRubles(list.totalSaved), ...sectionsOf(list.goals) }
      : {
          kind: "goal",
          goal: toDetails(goal, { today: dependencies.today(), timeZone: dependencies.timeZone() }),
          isCelebrating: navigation.isCelebrating(),
        };
  }, "goals.screen");
}

function reatomCompletion(dependencies: GoalsDependencies, openedGoal: () => Goal | undefined) {
  return action(async (outcome: GoalOutcome) => {
    const goal = openedGoal();
    const choice = goal && (await wrap(dependencies.telegram.showPopup(outcomeQuestions[outcome])));

    if (goal !== undefined && choice === "confirm") {
      dependencies.goals.keep(await wrap(dependencies.api.complete(goal.id, outcome)));
    }
  }, "goals.complete").extend(withAsync());
}

function reatomRemoval(dependencies: GoalsDependencies, openedGoal: () => Goal | undefined) {
  return action(async (movementId: string) => {
    const goal = openedGoal();
    const choice =
      goal &&
      (await wrap(
        dependencies.telegram.showPopup({
          title: "Удалить запись?",
          message: "Баланс цели пересчитается.",
          buttons: [
            { id: "confirm", type: "destructive", text: "Удалить" },
            { id: "cancel", type: "cancel" },
          ],
        }),
      ));

    if (goal !== undefined && choice === "confirm") {
      dependencies.goals.keep(
        await wrap(dependencies.api.removeMovement({ goalId: goal.id, movementId })),
      );
    }
  }, "goals.removeMovement").extend(withAsync());
}

function reatomBrowsing({ editing, openedGoalId, isCelebrating }: Navigation) {
  return {
    open: action((goalId: string) => {
      openedGoalId.set(goalId);
      isCelebrating.set(false);
    }, "goals.open"),
    back: action(() => {
      if (editing() === undefined) {
        openedGoalId.set(undefined);
      } else {
        editing.set(undefined);
      }

      isCelebrating.set(false);
    }, "goals.back"),
  };
}

function reatomEditing(
  { editing }: Navigation,
  { openedGoal, goalForm, movementForm }: Forms & { openedGoal: () => Goal | undefined },
) {
  return {
    add: action(() => {
      goalForm.startCreating();
      editing.set("goal");
    }, "goals.add"),
    edit: action(() => {
      const goal = openedGoal();

      if (goal !== undefined) {
        goalForm.startEditing(goal);
        editing.set("goal");
      }
    }, "goals.edit"),
    addMovement: action((kind: MovementKind) => {
      const goal = openedGoal();

      if (goal !== undefined) {
        movementForm.startAdding(goal, kind);
        editing.set("movement");
      }
    }, "goals.addMovement"),
    editMovement: action((movementId: string) => {
      const goal = openedGoal();

      if (goal !== undefined) {
        movementForm.startEditing(goal, movementId);
        editing.set("movement");
      }
    }, "goals.editMovement"),
  };
}

function titleOf(screen: GoalsScreen): string {
  if (screen.kind === "goal") {
    return screen.goal.title;
  }

  if (screen.kind === "goal-form") {
    return screen.isCreating ? "Новая цель" : "Цель";
  }

  if (screen.kind === "movement-form") {
    return screen.isWithdrawal ? "Снятие" : "Пополнение";
  }

  return "Цели";
}

export function reatomGoalsScreen(dependencies: GoalsDependencies) {
  const navigation: Navigation = {
    editing: atom<"goal" | "movement" | undefined>(undefined, "goals.editing"),
    openedGoalId: atom<string | undefined>(undefined, "goals.openedGoalId"),
    isCelebrating: atom(false, "goals.isCelebrating"),
  };
  const openedGoal = computed(
    () => dependencies.goals.list.data()?.goals.find(({ id }) => id === navigation.openedGoalId()),
    "goals.openedGoal",
  );
  const forms = reatomForms(dependencies, navigation);
  const screen = reatomScreen(dependencies, navigation, { ...forms, openedGoal });
  const complete = reatomCompletion(dependencies, openedGoal);
  const removeMovement = reatomRemoval(dependencies, openedGoal);

  return {
    screen,
    title: computed(() => titleOf(screen()), "goals.title"),
    canGoBack: computed(
      () => navigation.editing() !== undefined || openedGoal() !== undefined,
      "goals.canGoBack",
    ),
    isChanging: computed(() => !complete.ready() || !removeMovement.ready(), "goals.isChanging"),
    complete: action((outcome: GoalOutcome) => {
      complete(outcome).catch(noop);
    }, "goals.completeGoal"),
    removeMovement: action((movementId: string) => {
      removeMovement(movementId).catch(noop);
    }, "goals.removeOneMovement"),
    ...forms,
    ...reatomBrowsing(navigation),
    ...reatomEditing(navigation, { ...forms, openedGoal }),
  };
}

export type GoalsScreenModel = ReturnType<typeof reatomGoalsScreen>;
