import {
  action,
  atom,
  computed,
  peek,
  reatomBoolean,
  reatomEnum,
  withAsyncData,
  wrap,
} from "@reatom/core";

import { recipeList, recipeTagList, type Recipe } from "@family-hub/contract";

import type { DeviceCache } from "@/common/device-cache";
import type { LiveVersion } from "@/common/live-updates";
import { readOnly } from "@/common/state";

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
  const ordering = reatomEnum(["title", "forgotten"], "recipes.sort");

  return {
    text,
    tagId,
    isFavorite,
    ordering,
    isWholeBook: computed(
      () => text() === "" && tagId() === undefined && !isFavorite() && ordering() === "title",
      "recipes.isWholeBook",
    ),
  };
}

// The list follows the search text, the tag chip and «⭐»; every change reloads it from the server.
export function reatomRecipesData({ api, liveVersion, deviceCache }: RecipesDataDependencies) {
  const version = atom(0, "recipes.version");
  const { text, tagId, isFavorite, ordering, isWholeBook } = reatomQuery();
  const list = computed(async () => {
    version();
    liveVersion?.();

    return wrap(
      api.list({ text: text(), tagId: tagId(), isFavorite: isFavorite(), sort: ordering() }),
    );
  }, "recipes.list").extend(withAsyncData());
  const tags = computed(async () => {
    version();
    liveVersion?.();

    return wrap(api.tags());
  }, "recipes.tags").extend(withAsyncData());

  // The next launch opens on the whole book in its usual order, so a search keeps the last one.
  list.data.extend(
    deviceCache.withDeviceCache({
      key: "recipes",
      schema: recipeList,
      version: 1,
      cachedPart: (recipes) => (peek(isWholeBook) ? cardsOf(recipes) : undefined),
    }),
  );
  tags.data.extend(
    deviceCache.withDeviceCache({ key: "recipe-tags", schema: recipeTagList, version: 1 }),
  );

  return {
    version: readOnly(version),
    text,
    tagId,
    isFavorite,
    ordering,
    list,
    tags,

    reload: action(() => {
      version.set(version() + 1);
    }, "recipes.reload"),
  };
}

export type RecipesData = ReturnType<typeof reatomRecipesData>;
