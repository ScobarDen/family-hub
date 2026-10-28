import type { Photo, Recipe } from "@family-hub/contract";

import { formatDay, type Viewer } from "@/common/format-date";

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

function cookedSummaryOf({ cookedCount, lastCookedAt }: Recipe, viewer: Viewer): string {
  return lastCookedAt === null
    ? "Ещё не готовили"
    : `Готовили ${cookedCount} раз · последний раз ${formatDay(lastCookedAt, viewer)}`;
}

export function toRecipeDetails(recipe: Recipe, viewer: Viewer): RecipeDetails {
  return {
    id: recipe.id,
    title: recipe.title,
    photos: recipe.photos,
    ingredients: recipe.ingredients,
    method: recipe.method,
    isFavorite: recipe.isFavorite,
    canDelete: recipe.canDelete,
    cookedSummary: cookedSummaryOf(recipe, viewer),
    cooks: recipe.cooks.map(({ id, memberName, at, isOwn }) => ({
      id,
      memberName,
      day: formatDay(at, viewer),
      isOwn,
    })),
  };
}

function cookedOf(recipe: Recipe, cooks: Recipe["cooks"]): Recipe {
  const [last] = cooks;

  return { ...recipe, cooks, cookedCount: cooks.length, lastCookedAt: last?.at ?? null };
}

// A mark not yet saved has no id or name of its own and cannot be taken away until it is.
export function withCook(recipe: Recipe, at: number): Recipe {
  const cook = { id: `unsaved-${String(at)}`, at, memberName: "", isOwn: false };

  return cookedOf(
    recipe,
    [...recipe.cooks, cook].toSorted((one, other) => other.at - one.at),
  );
}

export function withoutCook(recipe: Recipe, cookId: string): Recipe {
  return cookedOf(
    recipe,
    recipe.cooks.filter(({ id }) => id !== cookId),
  );
}
