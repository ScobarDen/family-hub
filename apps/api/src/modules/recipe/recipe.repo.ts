import { and, asc, eq, inArray } from "drizzle-orm";

import {
  photos,
  recipeFavorites,
  recipePhotos,
  recipeTagLinks,
  recipeTags,
  recipes,
  type Db,
} from "@/common/db";

export type RecipeRow = typeof recipes.$inferSelect;
export type TagRow = typeof recipeTags.$inferSelect;
export type PhotoRow = typeof photos.$inferSelect;

type RecipeTarget = { familyId: string; recipeId: string };
type TagTarget = { familyId: string; tagId: string };
type Links = { familyId: string; ids: string[] };

function ofRecipe({ familyId, recipeId }: RecipeTarget) {
  return and(eq(recipes.familyId, familyId), eq(recipes.id, recipeId));
}

function ofTag({ familyId, tagId }: TagTarget) {
  return and(eq(recipeTags.familyId, familyId), eq(recipeTags.id, tagId));
}

async function linksOf(db: Db, familyId: string) {
  const [tagged, pictured] = await Promise.all([
    db
      .select({ recipeId: recipeTagLinks.recipeId, tag: recipeTags })
      .from(recipeTagLinks)
      .innerJoin(recipeTags, eq(recipeTags.id, recipeTagLinks.tagId))
      .where(eq(recipeTagLinks.familyId, familyId))
      .all(),
    db
      .select({ recipeId: recipePhotos.recipeId, photo: photos })
      .from(recipePhotos)
      .innerJoin(photos, eq(photos.id, recipePhotos.photoId))
      .where(eq(recipePhotos.familyId, familyId))
      .orderBy(asc(recipePhotos.position))
      .all(),
  ]);

  return { tagged, pictured };
}

async function favoritesOf(db: Db, { familyId, memberId }: { familyId: string; memberId: string }) {
  const rows = await db
    .select({ recipeId: recipeFavorites.recipeId })
    .from(recipeFavorites)
    .where(and(eq(recipeFavorites.familyId, familyId), eq(recipeFavorites.memberId, memberId)))
    .all();

  return rows.map(({ recipeId }) => recipeId);
}

async function setLinks(
  db: Db,
  { familyId, recipeId, tagIds, photoIds }: RecipeTarget & { tagIds: string[]; photoIds: string[] },
) {
  await db.batch([
    db.delete(recipeTagLinks).where(eq(recipeTagLinks.recipeId, recipeId)),
    db.delete(recipePhotos).where(eq(recipePhotos.recipeId, recipeId)),
    ...tagIds.map((tagId) => db.insert(recipeTagLinks).values({ recipeId, tagId, familyId })),
    ...photoIds.map((photoId, position) =>
      db.insert(recipePhotos).values({ recipeId, photoId, familyId, position }),
    ),
  ]);
}

async function setFavorite(
  db: Db,
  {
    familyId,
    recipeId,
    memberId,
    isFavorite,
  }: RecipeTarget & { memberId: string; isFavorite: boolean },
) {
  await (isFavorite
    ? db.insert(recipeFavorites).values({ recipeId, memberId, familyId }).onConflictDoNothing()
    : db
        .delete(recipeFavorites)
        .where(
          and(eq(recipeFavorites.recipeId, recipeId), eq(recipeFavorites.memberId, memberId)),
        ));
}

async function knownIds(
  db: Db,
  {
    familyId,
    table,
    ids,
  }: { familyId: string; table: typeof photos | typeof recipeTags; ids: string[] },
): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.familyId, familyId), inArray(table.id, ids)))
    .all();

  return rows.map(({ id }) => id);
}

export function createRecipeRepo(db: Db) {
  return {
    recipesOf: async (familyId: string) =>
      db.select().from(recipes).where(eq(recipes.familyId, familyId)).all(),
    linksOf: async (familyId: string) => linksOf(db, familyId),
    favoritesOf: async (viewer: { familyId: string; memberId: string }) => favoritesOf(db, viewer),
    tagsOf: async (familyId: string) =>
      db.select().from(recipeTags).where(eq(recipeTags.familyId, familyId)).all(),
    find: async (target: RecipeTarget) => db.select().from(recipes).where(ofRecipe(target)).get(),
    findTag: async (target: TagTarget) => db.select().from(recipeTags).where(ofTag(target)).get(),
    knownTagIds: async ({ familyId, ids }: Links) =>
      knownIds(db, { familyId, table: recipeTags, ids }),
    knownPhotoIds: async ({ familyId, ids }: Links) =>
      knownIds(db, { familyId, table: photos, ids }),

    async add(row: typeof recipes.$inferInsert): Promise<void> {
      await db.insert(recipes).values(row);
    },
    async update(target: RecipeTarget, values: Partial<typeof recipes.$inferInsert>) {
      await db.update(recipes).set(values).where(ofRecipe(target));
    },
    async delete(target: RecipeTarget): Promise<void> {
      await db.delete(recipes).where(ofRecipe(target));
    },
    setLinks: async (links: RecipeTarget & { tagIds: string[]; photoIds: string[] }) =>
      setLinks(db, links),
    setFavorite: async (favorite: RecipeTarget & { memberId: string; isFavorite: boolean }) =>
      setFavorite(db, favorite),

    async addTag(row: typeof recipeTags.$inferInsert): Promise<void> {
      await db.insert(recipeTags).values(row);
    },
    async renameTag(target: TagTarget, { name, now }: { name: string; now: number }) {
      await db.update(recipeTags).set({ name, updatedAt: now }).where(ofTag(target));
    },
    async deleteTag(target: TagTarget): Promise<void> {
      await db.delete(recipeTags).where(ofTag(target));
    },
  };
}

export type RecipeRepo = ReturnType<typeof createRecipeRepo>;
