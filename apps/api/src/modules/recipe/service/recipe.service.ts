import type { RecipeChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import type { RecipeDependencies, RecipeQuery } from "../recipe.types.ts";
import { list } from "./recipe-read.service.ts";
import { create, current, remove, setFavorite, update } from "./recipe-write.service.ts";
import { addTag, removeTag, renameTag, tags } from "./tag.service.ts";

export function createRecipeService(dependencies: RecipeDependencies) {
  return {
    list: async (membership: Membership, query: RecipeQuery) =>
      list(dependencies, membership, query),
    get: async (membership: Membership, recipeId: string) =>
      current(dependencies, membership, recipeId),
    create: async (membership: Membership, change: RecipeChange) =>
      create(dependencies, membership, change),
    update: async (membership: Membership, recipeId: string, change: RecipeChange) =>
      update(dependencies, membership, { recipeId, change }),
    remove: async (membership: Membership, recipeId: string) =>
      remove(dependencies, membership, recipeId),
    setFavorite: async (membership: Membership, recipeId: string, isFavorite: boolean) =>
      setFavorite(dependencies, membership, { recipeId, isFavorite }),
    tags: async (membership: Membership) => tags(dependencies, membership),
    addTag: async (membership: Membership, name: string) => addTag(dependencies, membership, name),
    renameTag: async (membership: Membership, tagId: string, name: string) =>
      renameTag(dependencies, membership, { tagId, name }),
    removeTag: async (membership: Membership, tagId: string) =>
      removeTag(dependencies, membership, tagId),
  };
}

export type RecipeService = ReturnType<typeof createRecipeService>;
