import { uuidv7 } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

import type { RecipeDependencies, RecipeResult } from "../recipe.types.ts";
import { current } from "./recipe-write.service.ts";

// «🍳 Приготовили» may be marked for a day gone by, never for one to come.
export async function cook(
  dependencies: RecipeDependencies,
  membership: Membership,
  { recipeId, cookedAt }: { recipeId: string; cookedAt: number | null },
): Promise<RecipeResult> {
  const familyId = membership.family.id;
  const now = dependencies.clock.now();

  if (!(await dependencies.recipes.find({ familyId, recipeId }))) {
    return { status: "not-found" };
  }

  if (cookedAt !== null && cookedAt > now) {
    return { status: "cooked-in-future" };
  }

  await dependencies.recipes.addCook({
    id: uuidv7(now),
    familyId,
    recipeId,
    cookedAt: cookedAt ?? now,
    createdAt: now,
    createdBy: membership.member.id,
  });

  return current(dependencies, membership, recipeId);
}

// A Member takes back only their own mark.
export async function uncook(
  dependencies: RecipeDependencies,
  membership: Membership,
  { recipeId, cookId }: { recipeId: string; cookId: string },
): Promise<RecipeResult> {
  const target = { familyId: membership.family.id, cookId };
  const row = await dependencies.recipes.findCook(target);

  if (row?.recipeId !== recipeId) {
    return { status: "cooked-not-found" };
  }

  if (row.createdBy !== membership.member.id) {
    return { status: "not-author" };
  }

  await dependencies.recipes.deleteCook(target);

  return current(dependencies, membership, recipeId);
}
