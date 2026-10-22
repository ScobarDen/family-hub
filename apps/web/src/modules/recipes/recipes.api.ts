import {
  recipe,
  deleted,
  recipeList,
  recipeTag,
  recipeTagList,
  type Recipe,
  type RecipeChange,
} from "@family-hub/contract";

import type { HttpClient } from "@/common/http-client";
import { createPhotoCalls, resolvedPhoto } from "@/common/photo";

export type RecipeQuery = {
  text: string;
  tagId: string | undefined;
  isFavorite: boolean;
  sort: "title" | "forgotten";
};

function resolved(client: HttpClient, saved: Recipe): Recipe {
  return { ...saved, photos: saved.photos.map((each) => resolvedPhoto(each, client.url)) };
}

function queryOf({ text, tagId, isFavorite, sort }: RecipeQuery): string {
  const params = new URLSearchParams();

  if (text.trim() !== "") {
    params.set("q", text.trim());
  }

  if (tagId !== undefined) {
    params.set("tag", tagId);
  }

  if (isFavorite) {
    params.set("favorite", "true");
  }

  if (sort === "forgotten") {
    params.set("sort", "forgotten");
  }

  const query = params.toString();

  return query === "" ? "" : `?${query}`;
}

function tagCalls(client: HttpClient) {
  return {
    tags: async () => client.request("/api/recipe-tags", { schema: recipeTagList }),
    addTag: async (name: string) =>
      client.request("/api/recipe-tags", { method: "POST", body: { name }, schema: recipeTag }),
    renameTag: async (tagId: string, name: string) =>
      client.request(`/api/recipe-tags/${tagId}`, {
        method: "PUT",
        body: { name },
        schema: recipeTag,
      }),
    removeTag: async (tagId: string) =>
      client.request(`/api/recipe-tags/${tagId}`, { method: "DELETE", schema: deleted }),
  };
}

export function createRecipesApi(client: HttpClient) {
  async function one(
    path: string,
    init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown },
  ) {
    const saved = await client.request(path, { ...init, schema: recipe });

    return resolved(client, saved);
  }

  return {
    async list(query: RecipeQuery) {
      const recipes = await client.request(`/api/recipes${queryOf(query)}`, { schema: recipeList });

      return recipes.map((each) => resolved(client, each));
    },
    get: async (recipeId: string) => one(`/api/recipes/${recipeId}`, {}),
    create: async (change: RecipeChange) => one("/api/recipes", { method: "POST", body: change }),
    update: async (recipeId: string, change: RecipeChange) =>
      one(`/api/recipes/${recipeId}`, { method: "PUT", body: change }),
    remove: async (recipeId: string) =>
      client.request(`/api/recipes/${recipeId}`, { method: "DELETE", schema: deleted }),
    setFavorite: async (recipeId: string, isFavorite: boolean) =>
      one(`/api/recipes/${recipeId}/favorite`, { method: "PUT", body: { isFavorite } }),
    cook: async (recipeId: string, cookedAt: number | null) =>
      one(`/api/recipes/${recipeId}/cooked`, { method: "POST", body: { cookedAt } }),
    uncook: async (recipeId: string, cookId: string) =>
      one(`/api/recipes/${recipeId}/cooked/${cookId}`, { method: "DELETE" }),
    ...tagCalls(client),
    ...createPhotoCalls(client),
  };
}

export type RecipesApi = ReturnType<typeof createRecipesApi>;
