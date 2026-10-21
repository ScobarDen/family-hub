import { uuidv7, type RecipeChange } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import type { RecipeDependencies, RecipeRefusal, RecipeResult } from "../recipe.types.ts";
import { recipeOf } from "./recipe-read.service.ts";

export type DeleteResult = { status: "deleted" } | { status: RecipeRefusal };

export async function current(
  dependencies: RecipeDependencies,
  membership: Membership,
  recipeId: string,
): Promise<RecipeResult> {
  const recipe = await recipeOf(dependencies, membership, recipeId);

  return recipe ? { status: "ok", recipe } : { status: "not-found" };
}

// A Recipe links only the Family's own tags and photos.
async function linkRefusal(
  { recipes }: RecipeDependencies,
  { family }: Membership,
  { tagIds, photoIds }: RecipeChange,
): Promise<RecipeRefusal | undefined> {
  const [tags, photos] = await Promise.all([
    recipes.knownTagIds({ familyId: family.id, ids: tagIds }),
    recipes.knownPhotoIds({ familyId: family.id, ids: photoIds }),
  ]);

  if (tagIds.some((id) => !tags.includes(id))) {
    return "tag-not-found";
  }

  return photoIds.some((id) => !photos.includes(id)) ? "photo-not-found" : undefined;
}

function valuesOf({ title, ingredients, method }: RecipeChange) {
  return { title, ingredients, method };
}

export async function create(
  dependencies: RecipeDependencies,
  membership: Membership,
  change: RecipeChange,
): Promise<RecipeResult> {
  const refusal = await linkRefusal(dependencies, membership, change);

  if (refusal !== undefined) {
    return { status: refusal };
  }

  const now = dependencies.clock.now();
  const id = uuidv7(now);
  const familyId = membership.family.id;

  await dependencies.recipes.add({
    id,
    familyId,
    ...valuesOf(change),
    createdAt: now,
    createdBy: membership.member.id,
    updatedAt: now,
  });
  await dependencies.recipes.setLinks({ familyId, recipeId: id, ...change });

  return current(dependencies, membership, id);
}

export async function update(
  dependencies: RecipeDependencies,
  membership: Membership,
  { recipeId, change }: { recipeId: string; change: RecipeChange },
): Promise<RecipeResult> {
  const target = { familyId: membership.family.id, recipeId };

  if (!(await dependencies.recipes.find(target))) {
    return { status: "not-found" };
  }

  const refusal = await linkRefusal(dependencies, membership, change);

  if (refusal !== undefined) {
    return { status: refusal };
  }

  await dependencies.recipes.update(target, {
    ...valuesOf(change),
    updatedAt: dependencies.clock.now(),
  });
  await dependencies.recipes.setLinks({ ...target, ...change });

  return current(dependencies, membership, recipeId);
}

export async function remove(
  { recipes }: RecipeDependencies,
  membership: Membership,
  recipeId: string,
): Promise<DeleteResult> {
  const target = { familyId: membership.family.id, recipeId };
  const row = await recipes.find(target);

  if (!row) {
    return { status: "not-found" };
  }

  if (row.createdBy !== membership.member.id) {
    return { status: "not-author" };
  }

  await recipes.delete(target);

  return { status: "deleted" };
}

// Favourites are each Member's own.
export async function setFavorite(
  dependencies: RecipeDependencies,
  membership: Membership,
  { recipeId, isFavorite }: { recipeId: string; isFavorite: boolean },
): Promise<RecipeResult> {
  const target = { familyId: membership.family.id, recipeId };

  if (!(await dependencies.recipes.find(target))) {
    return { status: "not-found" };
  }

  await dependencies.recipes.setFavorite({ ...target, memberId: membership.member.id, isFavorite });

  return current(dependencies, membership, recipeId);
}
