import type { RecipeChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import type { RecipeDependencies, RecipeQuery } from "../recipe.types.ts";
import { cook, uncook } from "./cooked.service.ts";
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
    cook: async (membership: Membership, recipeId: string, cookedAt: number | null) =>
      cook(dependencies, membership, { recipeId, cookedAt }),
    uncook: async (membership: Membership, recipeId: string, cookId: string) =>
      uncook(dependencies, membership, { recipeId, cookId }),
    tags: async (membership: Membership) => tags(dependencies, membership),
    addTag: async (membership: Membership, name: string) => addTag(dependencies, membership, name),
    renameTag: async (membership: Membership, tagId: string, name: string) =>
      renameTag(dependencies, membership, { tagId, name }),
    removeTag: async (membership: Membership, tagId: string) =>
      removeTag(dependencies, membership, tagId),
  };
}

export type RecipeService = ReturnType<typeof createRecipeService>;
