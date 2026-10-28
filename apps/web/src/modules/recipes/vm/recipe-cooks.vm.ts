import { action, atom, computed, noop, wrap } from "@reatom/core";
import { Temporal } from "temporal-polyfill";

import type { Recipe } from "@family-hub/contract";

import { detached, reatomOptimistic, readOnly, type RollbackFailure } from "@/common/state";
import { type Confirmation, type Dialogs, isConfirmed } from "@/common/telegram";

import type { RecipesApi } from "../recipes.api.ts";
import { withCook, withoutCook } from "../recipes.lib.ts";
import type { RecipesData } from "../recipes.model.ts";

type CookDependencies = {
  api: RecipesApi;
  today: () => string;
  timeZone: () => string;
  telegram: Pick<Dialogs, "showPopup">;
};

type Opened = { data: { (): Recipe | undefined; set: (recipe: Recipe) => unknown } };

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

type Change = (
  shown: (recipe: Recipe) => Recipe,
  saving: (recipe: Recipe) => Promise<Recipe>,
) => Promise<void>;

// A cooked mark is gone for the whole Family once taken away, so it is confirmed first.
function reatomUncook(dependencies: CookDependencies, change: Change) {
  return action(async (cookId: string) => {
    if (await wrap(isConfirmed(dependencies.telegram, uncookQuestion))) {
      await wrap(
        change(
          (recipe) => withoutCook(recipe, cookId),
          async (recipe) => dependencies.api.uncook(recipe.id, cookId),
        ),
      );
    }
  }, "recipes.uncook");
}

type Sources = { data: RecipesData; opened: Opened; failure: RollbackFailure };

function reatomCookChange({ data, opened, failure }: Sources) {
  return reatomOptimistic(
    async (
      shown: (recipe: Recipe) => Recipe,
      saving: (recipe: Recipe) => Promise<Recipe>,
    ): Promise<void> => {
      const recipe = opened.data();

      if (recipe !== undefined) {
        opened.data.set(shown(recipe));
        opened.data.set(await wrap(saving(recipe)));
        data.reload();
      }
    },
    {
      name: "recipes.cooks.change",
      failure,
      refusal: "Не получилось сохранить готовку. Попробуйте ещё раз.",
    },
  );
}

export function reatomRecipeCooks(dependencies: CookDependencies, sources: Sources) {
  const { data } = sources;
  const change = reatomCookChange(sources);
  const uncook = reatomUncook(dependencies, change);
  const { cookDay, ...dayChoice } = reatomCookDay(dependencies);

  return {
    cookDay,
    ...dayChoice,
    // The mark shows at once; a second tap before it is saved would cook the dinner twice.
    canCook: computed(() => change.ready() && cookDay() !== "", "recipes.cooks.canCook"),
    ordering: readOnly(data.ordering),
    cook: action(() => {
      const cookedAt = cookedAtOf(dependencies, cookDay());

      change(
        (recipe) => withCook(recipe, cookedAt ?? Date.now()),
        async (recipe) => dependencies.api.cook(recipe.id, cookedAt),
      ).catch(noop);
    }, "recipes.cook"),
    uncook: detached(uncook, "recipes.uncookMark"),
    toggleForgotten: action(() => {
      data.ordering.set(data.ordering() === "forgotten" ? "title" : "forgotten");
    }, "recipes.toggleForgotten"),
  };
}
