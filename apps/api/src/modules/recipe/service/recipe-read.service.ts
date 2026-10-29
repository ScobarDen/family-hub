import type { Recipe } from "@family-hub/contract";

import type { Membership } from "@/modules/auth";

import { byTitle, isFoundBy, toRecipe, type RecipeParts } from "../recipe.lib.ts";
import type { RecipeRow } from "../recipe.repo.ts";
import type { RecipeDependencies, RecipeQuery } from "../recipe.types.ts";

async function recipesOf(
  { recipes, links }: RecipeDependencies,
  membership: Membership,
  rows: RecipeRow[],
): Promise<Recipe[]> {
  const familyId = membership.family.id;
  const memberId = membership.member.id;
  const viewer = { memberId, isFamilyOwner: membership.isFamilyOwner };
  const [{ tagged, pictured }, favorites] = await Promise.all([
    recipes.linksOf(familyId),
    recipes.favoritesOf({ familyId, memberId }),
  ]);

  return Promise.all(
    rows.map(async (row) => {
      const parts: RecipeParts = {
        tags: tagged
          .filter(({ recipeId }) => recipeId === row.id)
          .map(({ tag }) => ({ id: tag.id, name: tag.name })),
        photos: await Promise.all(
          pictured
            .filter(({ recipeId }) => recipeId === row.id)
            .map(async ({ photo }) => links.photoOf(photo, viewer)),
        ),
        isFavorite: favorites.includes(row.id),
      };

      return toRecipe(row, { memberId, parts });
    }),
  );
}

export async function list(
  dependencies: RecipeDependencies,
  membership: Membership,
  { text, tagId, isFavorite }: RecipeQuery,
): Promise<Recipe[]> {
  const rows = await dependencies.recipes.recipesOf(membership.family.id);
  const found = await recipesOf(
    dependencies,
    membership,
    rows.filter((row) => isFoundBy(row, text)),
  );

  return found
    .filter(
      (recipe) =>
        (tagId === undefined || recipe.tags.some(({ id }) => id === tagId)) &&
        (!isFavorite || recipe.isFavorite),
    )
    .toSorted(byTitle);
}

export async function recipeOf(
  dependencies: RecipeDependencies,
  membership: Membership,
  recipeId: string,
): Promise<Recipe | undefined> {
  const row = await dependencies.recipes.find({ familyId: membership.family.id, recipeId });

  if (!row) {
    return undefined;
  }

  const [recipe] = await recipesOf(dependencies, membership, [row]);

  return recipe;
}
