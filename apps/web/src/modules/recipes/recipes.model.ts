import { action, atom, computed, withAsyncData, wrap } from "@reatom/core";

import { readOnly } from "@/common/state";

import type { RecipesApi } from "./recipes.api.ts";

// The list follows the search text, the tag chip and «⭐»; every change reloads it from the server.
export function reatomRecipesData({ api }: { api: RecipesApi }) {
  const version = atom(0, "recipes.version");
  const text = atom("", "recipes.text");
  const tagId = atom<string | undefined>(undefined, "recipes.tagId");
  const isFavorite = atom(false, "recipes.isFavorite");
  const ordering = atom<"title" | "forgotten">("title", "recipes.sort");

  return {
    version: readOnly(version),
    text,
    tagId,
    isFavorite,
    ordering,
    list: computed(async () => {
      version();

      return wrap(
        api.list({ text: text(), tagId: tagId(), isFavorite: isFavorite(), sort: ordering() }),
      );
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
