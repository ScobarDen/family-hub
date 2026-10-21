import { action, atom, computed, withAsyncData, wrap } from "@reatom/core";

import type { RecipesApi } from "./recipes.api.ts";

// The list follows the search text, the tag chip and «⭐»; every change reloads it from the server.
export function reatomRecipesData({ api }: { api: RecipesApi }) {
  const version = atom(0, "recipes.version");
  const text = atom("", "recipes.text");
  const tagId = atom<string | undefined>(undefined, "recipes.tagId");
  const isFavorite = atom(false, "recipes.isFavorite");

  return {
    version: computed(() => version(), "recipes.changes"),
    text,
    tagId,
    isFavorite,
    list: computed(async () => {
      version();

      return wrap(api.list({ text: text(), tagId: tagId(), isFavorite: isFavorite() }));
    }, "recipes.list").extend(withAsyncData()),
    tags: computed(async () => {
      version();

      return wrap(api.tags());
    }, "recipes.tags").extend(withAsyncData()),

    reload: action(() => {
      version.set(version() + 1);
    }, "recipes.reload"),
  };
}

export type RecipesData = ReturnType<typeof reatomRecipesData>;
