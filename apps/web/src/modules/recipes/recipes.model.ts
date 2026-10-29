import {
  action,
  atom,
  computed,
  peek,
  reatomBoolean,
  withAsyncData,
  withRollback,
  wrap,
} from "@reatom/core";

import { recipeList, recipeTagList, type Recipe } from "@family-hub/contract";

import { rolledBackById } from "@/common/records.lib.ts";
import type { DeviceCache } from "@/modules/device-cache";
import type { LiveVersion } from "@/modules/live-updates";
import { readOnly } from "@/modules/state";

import type { RecipesApi } from "./recipes.api.ts";

type RecipesDataDependencies = LiveVersion & {
  api: RecipesApi;
  deviceCache: Pick<DeviceCache, "withDeviceCache">;
};

// The cooking steps stay on the server: a Recipe's own screen loads them.
function cardsOf(recipes: Recipe[] | undefined): Recipe[] | undefined {
  return recipes?.some(({ method }) => method !== null) === true
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

function reatomTags(
  { api, liveVersion, deviceCache }: RecipesDataDependencies,
  version: () => number,
) {
  const tags = computed(async () => {
    version();
    liveVersion?.();

    return wrap(api.tags());
  }, "recipes.tags").extend(withAsyncData());

  tags.data.extend(
    deviceCache.withDeviceCache({ key: "recipe-tags", schema: recipeTagList, version: 1 }),
    withRollback({ onRollback: rolledBackById }),
  );

  return tags;
}

// The list follows the search text, the tag chip and «⭐»; every change reloads it from the server.
export function reatomRecipesData({ api, liveVersion, deviceCache }: RecipesDataDependencies) {
  const version = atom(0, "recipes.version");
  const { text, tagId, isFavorite, isWholeBook } = reatomQuery();
  const list = computed(async () => {
    version();
    liveVersion?.();

    return wrap(api.list({ text: text(), tagId: tagId(), isFavorite: isFavorite() }));
  }, "recipes.list").extend(withAsyncData());
  const tags = reatomTags({ api, liveVersion, deviceCache }, version);

  // The next launch opens on the whole book in its usual order, so a search keeps the last one.
  list.data.extend(
    deviceCache.withDeviceCache({
      key: "recipes",
      schema: recipeList,
      version: 1,
      cachedPart: (recipes) => (peek(isWholeBook) ? cardsOf(recipes) : undefined),
    }),
    withRollback({ onRollback: rolledBackById }),
  );

  return {
    version: readOnly(version),
    text,
    tagId,
    isFavorite,
    list,
    tags,
    reload: action(() => {
      version.set(version() + 1);
    }, "recipes.reload"),
  };
}

export type RecipesData = ReturnType<typeof reatomRecipesData>;
