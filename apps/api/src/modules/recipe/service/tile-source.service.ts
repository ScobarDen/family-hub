import type { TileSource } from "@/modules/today";

import type { RecipeRepo } from "../recipe.repo.ts";

export function createRecipeTile({ recipes }: { recipes: RecipeRepo }): TileSource<"recipes"> {
  return {
    tile: async ({ family }) => ({ lastCooked: (await recipes.lastCookedOf(family.id)) ?? null }),
  };
}
