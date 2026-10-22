import type { Photo, Recipe } from "@family-hub/contract";

import { formatDay } from "@/common/format-date";

export type RecipeItem = {
  id: string;
  title: string;
  isFavorite: boolean;
  subtitle: string | undefined;
};

export type CookedItem = { id: string; memberName: string; day: string; isOwn: boolean };

export type RecipeDetails = {
  id: string;
  title: string;
  photos: Photo[];
  ingredients: string[];
  method: string | null;
  isFavorite: boolean;
  canDelete: boolean;
  cookedSummary: string;
  cooks: CookedItem[];
};

export function toRecipeItem({ id, title, isFavorite, tags }: Recipe): RecipeItem {
  return {
    id,
    title,
    isFavorite,
    subtitle: tags.map(({ name }) => name).join(" · ") || undefined,
  };
}

function cookedSummaryOf({ cookedCount, lastCookedAt }: Recipe, timeZone: string): string {
  return lastCookedAt === null
    ? "Ещё не готовили"
    : `Готовили ${cookedCount} раз · последний раз ${formatDay(lastCookedAt, timeZone)}`;
}

export function toRecipeDetails(recipe: Recipe, timeZone: string): RecipeDetails {
  return {
    id: recipe.id,
    title: recipe.title,
    photos: recipe.photos,
    ingredients: recipe.ingredients,
    method: recipe.method,
    isFavorite: recipe.isFavorite,
    canDelete: recipe.canDelete,
    cookedSummary: cookedSummaryOf(recipe, timeZone),
    cooks: recipe.cooks.map(({ id, memberName, at, isOwn }) => ({
      id,
      memberName,
      day: formatDay(at, timeZone),
      isOwn,
    })),
  };
}
