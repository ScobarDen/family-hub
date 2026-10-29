import { uuidv7, type RecipeTag } from "@family-hub/contract";

import type { Membership } from "@/modules/auth";

import type { RecipeDependencies, TagResult } from "../recipe.types.ts";

export async function tags(
  { recipes }: RecipeDependencies,
  { family }: Membership,
): Promise<RecipeTag[]> {
  const rows = await recipes.tagsOf(family.id);

  return rows
    .map(({ id, name }) => ({ id, name }))
    .toSorted((left, right) => left.name.localeCompare(right.name, "ru-RU"));
}

export async function addTag(
  { recipes, clock }: RecipeDependencies,
  { family, member }: Membership,
  name: string,
): Promise<RecipeTag> {
  const now = clock.now();
  const id = uuidv7(now);

  await recipes.addTag({
    id,
    familyId: family.id,
    name,
    createdAt: now,
    createdBy: member.id,
    updatedAt: now,
  });

  return { id, name };
}

export async function renameTag(
  { recipes, clock }: RecipeDependencies,
  { family }: Membership,
  { tagId, name }: { tagId: string; name: string },
): Promise<TagResult> {
  const target = { familyId: family.id, tagId };

  if (!(await recipes.findTag(target))) {
    return { status: "tag-not-found" };
  }

  await recipes.renameTag(target, { name, now: clock.now() });

  return { status: "ok", tag: { id: tagId, name } };
}

// Deleting a tag takes it off every Recipe; the Recipes stay.
export async function removeTag(
  { recipes }: RecipeDependencies,
  { family }: Membership,
  tagId: string,
): Promise<{ status: "deleted" } | { status: "tag-not-found" }> {
  const target = { familyId: family.id, tagId };

  if (!(await recipes.findTag(target))) {
    return { status: "tag-not-found" };
  }

  await recipes.deleteTag(target);

  return { status: "deleted" };
}
