import { action, noop, withAsync, wrap } from "@reatom/core";

import { recipeTagNameMaxLength } from "@family-hub/contract";

import { detached, reatomFailure } from "@/common/state";
import { type Confirmation, type Dialogs, isConfirmed } from "@/common/telegram";

import type { RecipesApi } from "../recipes.api.ts";
import type { RecipesData } from "../recipes.model.ts";

type TagDependencies = {
  api: RecipesApi;
  telegram: Pick<Dialogs, "showPopup">;
};

const deleteQuestion: Confirmation = {
  title: "Удалить тег?",
  message: "Тег снимется со всех рецептов; сами рецепты останутся.",
  button: "Удалить",
};

function nameOf(text: string): string | undefined {
  const name = text.trim();

  return name === "" || name.length > recipeTagNameMaxLength ? undefined : name;
}

// The Family's tags: anyone adds, renames or deletes one.
export function reatomTagEditing({ api, telegram }: TagDependencies, data: RecipesData) {
  const change = action(async (doing: () => Promise<unknown>) => {
    await wrap(doing());
    data.reload();
  }, "recipes.tags.change").extend(withAsync());
  const remove = action(async (tagId: string) => {
    if (await wrap(isConfirmed(telegram, deleteQuestion))) {
      await wrap(change(async () => api.removeTag(tagId)));
    }
  }, "recipes.tags.removeAsked").extend(withAsync());

  return {
    tagFailure: reatomFailure(change, {
      message: "Не получилось сохранить тег. Попробуйте ещё раз.",
      name: "recipes.tags.failure",
    }),
    addTag: action((text: string) => {
      const name = nameOf(text);

      if (name !== undefined) {
        change(async () => api.addTag(name)).catch(noop);
      }
    }, "recipes.tags.add"),
    renameTag: action((tagId: string, text: string) => {
      const name = nameOf(text);

      if (name !== undefined) {
        change(async () => api.renameTag(tagId, name)).catch(noop);
      }
    }, "recipes.tags.rename"),
    removeTag: detached(remove, "recipes.tags.remove"),
  };
}
