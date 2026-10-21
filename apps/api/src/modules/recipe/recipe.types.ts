import type { Recipe, RecipeTag } from "@family-hub/contract";

import type { Clock } from "@/common/clock";
import type { PhotoLinks } from "@/common/photo-link";

import type { RecipeRepo } from "./recipe.repo.ts";

export type RecipeDependencies = { recipes: RecipeRepo; links: PhotoLinks; clock: Clock };

export type RecipeRefusal = "not-found" | "not-author" | "tag-not-found" | "photo-not-found";

export type RecipeResult = { status: "ok"; recipe: Recipe } | { status: RecipeRefusal };

export type TagResult = { status: "ok"; tag: RecipeTag } | { status: "tag-not-found" };

export type RecipeQuery = {
  text: string | undefined;
  tagId: string | undefined;
  isFavorite: boolean;
};
