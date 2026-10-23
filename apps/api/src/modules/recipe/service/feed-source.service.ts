import type { FeedActivity } from "@family-hub/contract";

import type { Membership } from "@/common/auth";
import type { KeysetPage } from "@/common/keyset";
import type { PhotoLinks } from "@/common/photo-link";
import { previewOf, type ActivitySource } from "@/modules/feed";

import type { RecipeRepo } from "../recipe.repo.ts";

type RecipeFeedDependencies = { recipes: RecipeRepo; links: PhotoLinks };

// «Ася приготовила лазанью» comes with the Recipe's first photo; Recipes are always Shared.
async function cookedBefore(
  { recipes, links }: RecipeFeedDependencies,
  viewer: Membership,
  page: KeysetPage,
): Promise<FeedActivity[]> {
  const cooks = await recipes.cooksBefore(viewer.family.id, page);
  const pictured = await recipes.photosOf({
    familyId: viewer.family.id,
    ids: [...new Set(cooks.map(({ recipeId }) => recipeId))],
  });

  return Promise.all(
    cooks.map(async (cook) => {
      const first = pictured.find(({ recipeId }) => recipeId === cook.recipeId);

      return {
        kind: "cooked" as const,
        key: cook.key,
        at: cook.cookedAt,
        memberName: cook.memberName,
        memberPicture: cook.memberPicture,
        title: cook.title,
        recipeId: cook.recipeId,
        ...(await previewOf(links, { rows: first === undefined ? [] : [first.photo], viewer })),
      };
    }),
  );
}

export function createRecipeFeed(dependencies: RecipeFeedDependencies): ActivitySource {
  return {
    before: async (viewer, page) => cookedBefore(dependencies, viewer, page),
  };
}
