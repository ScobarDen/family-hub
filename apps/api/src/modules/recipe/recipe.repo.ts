import { and, asc, eq, inArray } from "drizzle-orm";

import { bindFirst } from "@/common/bind";
import {
  members,
  photos,
  recipeCooks,
  recipeFavorites,
  recipePhotos,
  recipeTagLinks,
  recipeTags,
  recipes,
  type Db,
} from "@/common/db";
import { keyOf, newestFirstBy, olderThan, type KeysetPage } from "@/common/keyset";
import { knownPhotoIds } from "@/modules/photo";

export type RecipeRow = typeof recipes.$inferSelect;
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
    db
      .delete(recipeTagLinks)
      .where(and(eq(recipeTagLinks.familyId, familyId), eq(recipeTagLinks.recipeId, recipeId))),
    db
      .delete(recipePhotos)
      .where(and(eq(recipePhotos.familyId, familyId), eq(recipePhotos.recipeId, recipeId))),
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
          and(
            eq(recipeFavorites.familyId, familyId),
            eq(recipeFavorites.recipeId, recipeId),
            eq(recipeFavorites.memberId, memberId),
          ),
        ));
}

async function knownTagIds(db: Db, { familyId, ids }: Links): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: recipeTags.id })
    .from(recipeTags)
    .where(and(eq(recipeTags.familyId, familyId), inArray(recipeTags.id, ids)))
    .all();

  return rows.map(({ id }) => id);
}

type CookRow = typeof recipeCooks.$inferSelect & { memberName: string };

async function cooksOf(db: Db, familyId: string): Promise<CookRow[]> {
  const rows = await db
    .select({ cook: recipeCooks, memberName: members.name })
    .from(recipeCooks)
    .innerJoin(members, eq(members.id, recipeCooks.createdBy))
    .where(eq(recipeCooks.familyId, familyId))
    .all();

  return rows.map(({ cook, memberName }) => ({ ...cook, memberName }));
}

const cookKeyed = { at: recipeCooks.cookedAt, key: keyOf("cooked", recipeCooks.id) };

async function cooksBefore(db: Db, familyId: string, { keyset, limit }: KeysetPage) {
  return db
    .select({
      key: cookKeyed.key,
      recipeId: recipeCooks.recipeId,
      cookedAt: recipeCooks.cookedAt,
      title: recipes.title,
      memberName: members.name,
    })
    .from(recipeCooks)
    .innerJoin(recipes, eq(recipes.id, recipeCooks.recipeId))
    .innerJoin(members, eq(members.id, recipeCooks.createdBy))
    .where(and(eq(recipeCooks.familyId, familyId), olderThan(cookKeyed, keyset)))
    .orderBy(...newestFirstBy(cookKeyed))
    .limit(limit)
    .all();
}

async function photosOf(db: Db, { familyId, ids }: Links) {
  if (ids.length === 0) {
    return [];
  }

  return db
    .select({ recipeId: recipePhotos.recipeId, photo: photos })
    .from(recipePhotos)
    .innerJoin(photos, eq(photos.id, recipePhotos.photoId))
    .where(and(eq(recipePhotos.familyId, familyId), inArray(recipePhotos.recipeId, ids)))
    .orderBy(asc(recipePhotos.position))
    .all();
}

function ofCook({ familyId, cookId }: { familyId: string; cookId: string }) {
  return and(eq(recipeCooks.familyId, familyId), eq(recipeCooks.id, cookId));
}

// «🍳 Приготовили» marks, each with the Member who made it.
function cookCalls(db: Db) {
  return {
    ...bindFirst(db, { cooksOf, cooksBefore, photosOf }),
    findCook: async (target: { familyId: string; cookId: string }) =>
      db.select().from(recipeCooks).where(ofCook(target)).get(),
    async addCook(row: typeof recipeCooks.$inferInsert): Promise<void> {
      await db.insert(recipeCooks).values(row);
    },
    async deleteCook(target: { familyId: string; cookId: string }): Promise<void> {
      await db.delete(recipeCooks).where(ofCook(target));
    },
  };
}

export function createRecipeRepo(db: Db) {
  return {
    ...bindFirst(db, { linksOf, favoritesOf, knownTagIds, setLinks, setFavorite }),
    recipesOf: async (familyId: string) =>
      db.select().from(recipes).where(eq(recipes.familyId, familyId)).all(),
    ...cookCalls(db),
    tagsOf: async (familyId: string) =>
      db.select().from(recipeTags).where(eq(recipeTags.familyId, familyId)).all(),
    find: async (target: RecipeTarget) => db.select().from(recipes).where(ofRecipe(target)).get(),
    findTag: async (target: TagTarget) => db.select().from(recipeTags).where(ofTag(target)).get(),
    knownPhotoIds: async ({ familyId, ids }: Links) => knownPhotoIds(db, familyId, ids),

    async add(row: typeof recipes.$inferInsert): Promise<void> {
      await db.insert(recipes).values(row);
    },
    async update(target: RecipeTarget, values: Partial<typeof recipes.$inferInsert>) {
      await db.update(recipes).set(values).where(ofRecipe(target));
    },
    async delete(target: RecipeTarget): Promise<void> {
      await db.delete(recipes).where(ofRecipe(target));
    },

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
