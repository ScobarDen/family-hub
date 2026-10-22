import { action, computed, noop, withAsync, wrap } from "@reatom/core";
import { Temporal } from "temporal-polyfill";

import type { Recipe } from "@family-hub/contract";

import { readOnly } from "@/common/state";
import { didSucceedOrAlert, type Dialogs } from "@/common/telegram";

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

  return {
    isCooking: computed(() => !change.ready(), "recipes.cooks.isCooking"),
    today: readOnly(dependencies.today),
    ordering: readOnly(data.ordering),
    cook: action((date: string) => {
      change(async (recipe) =>
        dependencies.api.cook(recipe.id, cookedAtOf(dependencies, date)),
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
