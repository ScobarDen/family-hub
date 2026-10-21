import type { Photo, Recipe, RecipeTag } from "@family-hub/contract";

import type { RecipeRow } from "./recipe.repo.ts";

export type RecipeParts = { tags: RecipeTag[]; photos: Photo[]; isFavorite: boolean };

export function ingredientsOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

// The author alone deletes a Recipe; any Member edits it.
export function toRecipe(
  row: RecipeRow,
  { memberId, parts }: { memberId: string; parts: RecipeParts },
): Recipe {
  return {
    id: row.id,
    title: row.title,
    ingredients: ingredientsOf(row.ingredients),
    method: row.method,
    ...parts,
    canDelete: row.createdBy === memberId,
    createdAt: row.createdAt,
  };
}

function normalized(text: string): string {
  return text.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

// Every word of the query is found somewhere in the title, the ingredients or the method.
export function isFoundBy(row: RecipeRow, text: string | undefined): boolean {
  const words = normalized(text ?? "")
    .split(/\s+/u)
    .filter((word) => word !== "");
  const haystack = normalized([row.title, row.ingredients, row.method ?? ""].join("\n"));

  return words.every((word) => haystack.includes(word));
}

export function byTitle(left: Recipe, right: Recipe): number {
  return left.title.localeCompare(right.title, "ru-RU");
}
