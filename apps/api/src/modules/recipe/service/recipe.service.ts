import type { RecipeChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import { bindFirst } from "@/common/bind";

import type { RecipeDependencies } from "../recipe.types.ts";
import { cook, uncook } from "./cooked.service.ts";
import { list } from "./recipe-read.service.ts";
import { create, current, remove, setFavorite, update } from "./recipe-write.service.ts";
import { share } from "./share.service.ts";
import { addTag, removeTag, renameTag, tags } from "./tag.service.ts";

export function createRecipeService(dependencies: RecipeDependencies) {
  return {
    ...bindFirst(dependencies, {
      list,
      get: current,
      create,
      remove,
      share,
      tags,
      addTag,
      removeTag,
    }),
    update: async (membership: Membership, recipeId: string, change: RecipeChange) =>
      update(dependencies, membership, { recipeId, change }),
    setFavorite: async (membership: Membership, recipeId: string, isFavorite: boolean) =>
      setFavorite(dependencies, membership, { recipeId, isFavorite }),
    cook: async (membership: Membership, recipeId: string, cookedAt: number | null) =>
      cook(dependencies, membership, { recipeId, cookedAt }),
    uncook: async (membership: Membership, recipeId: string, cookId: string) =>
      uncook(dependencies, membership, { recipeId, cookId }),
    renameTag: async (membership: Membership, tagId: string, name: string) =>
      renameTag(dependencies, membership, { tagId, name }),
  };
}

export type RecipeService = ReturnType<typeof createRecipeService>;
