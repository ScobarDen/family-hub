import { action, atom, computed, noop, withAsync, wrap } from "@reatom/core";

import { recipeTagNameMaxLength } from "@family-hub/contract";

import type { PopupParams } from "@/common/telegram";

import type { RecipesApi } from "../recipes.api.ts";
import type { RecipesData } from "../recipes.model.ts";

type TagDependencies = {
  api: RecipesApi;
  telegram: { showPopup: (params: PopupParams) => Promise<string | undefined> };
};

const deleteQuestion: PopupParams = {
  title: "Удалить тег?",
  message: "Тег снимется со всех рецептов; сами рецепты останутся.",
  buttons: [
    { id: "delete", type: "destructive", text: "Удалить" },
    { id: "cancel", type: "cancel" },
  ],
};

function nameOf(text: string): string | undefined {
  const name = text.trim();

  return name === "" || name.length > recipeTagNameMaxLength ? undefined : name;
}

// The Family's tags: anyone adds, renames or deletes one.
export function reatomTagEditing({ api, telegram }: TagDependencies, data: RecipesData) {
  const failure = atom<string | undefined>(undefined, "recipes.tags.failure");
  const change = action(async (doing: () => Promise<unknown>) => {
    failure.set(undefined);

    try {
      await wrap(doing());
      data.reload();
    } catch {
      failure.set("Не получилось сохранить тег. Попробуйте ещё раз.");
    }
  }, "recipes.tags.change").extend(withAsync());
  const remove = action(async (tagId: string) => {
    if ((await wrap(telegram.showPopup(deleteQuestion))) === "delete") {
      await wrap(change(async () => api.removeTag(tagId)));
    }
  }, "recipes.tags.removeAsked").extend(withAsync());

  return {
    tagFailure: computed(() => failure(), "recipes.tags.visibleFailure"),
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
    removeTag: action((tagId: string) => {
      remove(tagId).catch(noop);
    }, "recipes.tags.remove"),
  };
}
