import { action, atom, computed, noop, withAsync, wrap } from "@reatom/core";
import { Temporal } from "temporal-polyfill";

import type { Recipe } from "@family-hub/contract";

import { readOnly } from "@/common/state";
import { type Dialogs, didSucceedOrAlert } from "@/common/telegram";

import type { RecipesApi } from "../recipes.api.ts";
import type { RecipesData } from "../recipes.model.ts";

type CookDependencies = {
  api: RecipesApi;
  today: () => string;
  timeZone: () => string;
  telegram: Pick<Dialogs, "showAlert">;
};

const middayTime = "12:00";

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
    uncook: action((cookId: string) => {
      change(async (recipe) => dependencies.api.uncook(recipe.id, cookId)).catch(noop);
    }, "recipes.uncook"),
    toggleForgotten: action(() => {
      data.ordering.set(data.ordering() === "forgotten" ? "title" : "forgotten");
    }, "recipes.toggleForgotten"),
  };
}
