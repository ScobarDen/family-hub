import { action, atom, computed, peek, reatomBoolean } from "@reatom/core";

import { recipeList, recipeTagList, type Recipe } from "@family-hub/contract";

import { rolledBackById } from "@/common/records.lib.ts";
import type { DeviceCache } from "@/modules/device-cache";
import { reatomLiveResource } from "@/modules/live-resource";
import type { LiveVersion } from "@/modules/live-updates";

import type { RecipesApi } from "./recipes.api.ts";

type RecipesDataDependencies = LiveVersion & {
  api: RecipesApi;
  deviceCache: Pick<DeviceCache, "withDeviceCache">;
};

// The cooking steps stay on the server: a Recipe's own screen loads them.
function cardsOf(recipes: Recipe[]): Recipe[] {
  return recipes.some(({ method }) => method !== null)
    ? recipes.map((recipe) => ({ ...recipe, method: null }))
    : recipes;
}

function reatomQuery() {
  const text = atom("", "recipes.text");
  const tagId = atom<string | undefined>(undefined, "recipes.tagId");
  const isFavorite = reatomBoolean(false, "recipes.isFavorite");

  return {
    text,
    tagId,
    isFavorite,
    isWholeBook: computed(
      () => text() === "" && tagId() === undefined && !isFavorite(),
      "recipes.isWholeBook",
    ),
  };
}

function reatomTags({ api, liveVersion, deviceCache }: RecipesDataDependencies) {
  return reatomLiveResource({
    name: "recipes.tags",
    liveVersion,
    load: async () => api.tags(),
    cache: {
      withDeviceCache: deviceCache.withDeviceCache,
      key: "recipe-tags",
      schema: recipeTagList,
      version: 1,
    },
    rollback: { onRollback: rolledBackById },
  });
}

// The list follows the search text, the tag chip and «⭐»; every change reloads it from the server.
export function reatomRecipesData({ api, liveVersion, deviceCache }: RecipesDataDependencies) {
  const { text, tagId, isFavorite, isWholeBook } = reatomQuery();
  const list = reatomLiveResource({
    name: "recipes.list",
    liveVersion,
    load: async () => api.list({ text: text(), tagId: tagId(), isFavorite: isFavorite() }),
    // The next launch opens on the whole book in its usual order, so a search keeps the last one.
    cache: {
      withDeviceCache: deviceCache.withDeviceCache,
      key: "recipes",
      schema: recipeList,
      version: 1,
      cachedPart: (recipes) => (peek(isWholeBook) ? cardsOf(recipes) : undefined),
    },
    rollback: { onRollback: rolledBackById },
  });
  const tags = reatomTags({ api, liveVersion, deviceCache });

  return {
    text,
    tagId,
    isFavorite,
    list,
    tags,
    reload: action(() => {
      list.reload();
      tags.reload();
    }, "recipes.reload"),
  };
}

export type RecipesData = ReturnType<typeof reatomRecipesData>;
