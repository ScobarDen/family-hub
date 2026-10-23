import { action, atom, computed, noop, withAsync, wrap } from "@reatom/core";
import { Temporal } from "temporal-polyfill";

import type { Recipe } from "@family-hub/contract";

import { detached, readOnly } from "@/common/state";
import { type Confirmation, type Dialogs, didSucceedOrAlert, isConfirmed } from "@/common/telegram";

import type { RecipesApi } from "../recipes.api.ts";
import type { RecipesData } from "../recipes.model.ts";

type CookDependencies = {
  api: RecipesApi;
  today: () => string;
  timeZone: () => string;
  telegram: Pick<Dialogs, "showAlert" | "showPopup">;
};

const middayTime = "12:00";

const uncookQuestion: Confirmation = {
  title: "Удалить отметку «Приготовили»?",
  message: "Эта готовка пропадёт из истории рецепта.",
  button: "Удалить отметку",
};

// Today is «now»; a day gone by is marked at its midday on the Member's clock.
function cookedAtOf({ today, timeZone }: CookDependencies, date: string): number | null {
  return date === today()
    ? null
    : Temporal.PlainDateTime.from(`${date}T${middayTime}`).toZonedDateTime(timeZone())
        .epochMilliseconds;
}

// Today by default; an earlier day marks a dinner cooked before it was written down.
function reatomCookDay({ today }: CookDependencies) {
  const chosenDay = atom<string | undefined>(undefined, "recipes.cooks.chosenDay");

  return {
    today: readOnly(today),
    cookDay: computed(() => chosenDay() ?? today(), "recipes.cooks.day"),
    chooseCookDay: action((day: string) => {
      chosenDay.set(day);
    }, "recipes.chooseCookDay"),
  };
}

type Change = (doing: (recipe: Recipe) => Promise<unknown>) => Promise<unknown>;

// A cooked mark is gone for the whole Family once taken away, so it is confirmed first.
function reatomUncook(dependencies: CookDependencies, change: Change) {
  return action(async (cookId: string) => {
    if (await wrap(isConfirmed(dependencies.telegram, uncookQuestion))) {
      await wrap(change(async (recipe) => dependencies.api.uncook(recipe.id, cookId)));
    }
  }, "recipes.uncook").extend(withAsync());
}

export function reatomRecipeCooks(
  dependencies: CookDependencies,
  { data, opened }: { data: RecipesData; opened: () => Recipe | undefined },
) {
  const change = action(async (doing: (recipe: Recipe) => Promise<unknown>) => {
    const recipe = opened();

    const isSaved =
      recipe !== undefined &&
      (await wrap(
        didSucceedOrAlert(dependencies.telegram, {
          failure: "Не получилось сохранить готовку. Попробуйте ещё раз.",
          call: doing(recipe),
        }),
      ));

    if (isSaved) {
      data.reload();
    }
  }, "recipes.cooks.change").extend(withAsync());

  const uncook = reatomUncook(dependencies, change);
  const { cookDay, ...dayChoice } = reatomCookDay(dependencies);
  const isCooking = computed(() => !change.ready(), "recipes.cooks.isCooking");

  return {
    isCooking,
    cookDay,
    ...dayChoice,
    canCook: computed(() => !isCooking() && cookDay() !== "", "recipes.cooks.canCook"),
    ordering: readOnly(data.ordering),
    cook: action(() => {
      const day = cookDay();

      change(async (recipe) =>
        dependencies.api.cook(recipe.id, cookedAtOf(dependencies, day)),
      ).catch(noop);
    }, "recipes.cook"),
    uncook: detached(uncook, "recipes.uncookMark"),
    toggleForgotten: action(() => {
      data.ordering.set(data.ordering() === "forgotten" ? "title" : "forgotten");
    }, "recipes.toggleForgotten"),
  };
}
