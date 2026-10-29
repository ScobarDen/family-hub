import type { Membership } from "@/modules/auth";

import { shareCard } from "../recipe.lib.ts";
import type { RecipeDependencies, ShareResult } from "../recipe.types.ts";

export async function share(
  { recipes, bot, appLinks }: RecipeDependencies,
  membership: Membership,
  recipeId: string,
): Promise<ShareResult> {
  const familyId = membership.family.id;
  const row = await recipes.find({ familyId, recipeId });

  if (!row) {
    return { status: "not-found" };
  }

  const { pictured } = await recipes.linksOf(familyId);
  const photo = pictured.find((each) => each.recipeId === recipeId)?.photo;
  const prepared = await bot.call("savePreparedInlineMessage", {
    user_id: membership.member.telegramId,
    result: shareCard(row, {
      photoFileId: photo?.variants.full,
      link: await appLinks.appLink({ kind: "recipe", id: recipeId }),
    }),
    allow_user_chats: true,
    allow_group_chats: true,
  });

  return { status: "ok", preparedMessageId: prepared.id };
}
