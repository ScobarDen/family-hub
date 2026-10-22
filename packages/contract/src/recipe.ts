import { z } from "zod";

import { photo } from "./photo.ts";
import { deleted, named } from "./primitive.ts";
import { optionalText } from "./text.ts";

export const recipeTitleMaxLength = 200;
export const recipeTextMaxLength = 10_000;
export const recipePhotoMax = 10;
export const recipeTagNameMaxLength = 50;

// Ingredients are written one per line, as on a shopping list.
export const recipeChange = z.object({
  title: z.string().trim().min(1).max(recipeTitleMaxLength),
  ingredients: z.string().max(recipeTextMaxLength),
  method: optionalText(recipeTextMaxLength),
  photoIds: z.array(z.string()).max(recipePhotoMax).default([]),
  tagIds: z.array(z.string()).default([]),
});

export type RecipeChange = z.infer<typeof recipeChange>;

export const recipeTag = named;

export type RecipeTag = z.infer<typeof recipeTag>;

export const recipeTagList = z.array(recipeTag);

export const recipeTagChange = z.object({
  name: z.string().trim().min(1).max(recipeTagNameMaxLength),
});

// «🍳 Приготовили»: who cooked it and when, possibly a while ago.
export const cooked = z.object({
  id: z.string(),
  at: z.number(),
  memberName: z.string(),
  isOwn: z.boolean(),
});

export type Cooked = z.infer<typeof cooked>;

export const cookedChange = z.object({
  cookedAt: z.number().int().positive().nullable().default(null),
});

export const recipe = z.object({
  id: z.string(),
  title: z.string(),
  ingredients: z.array(z.string()),
  method: z.string().nullable(),
  photos: z.array(photo),
  tags: z.array(recipeTag),
  isFavorite: z.boolean(),
  canDelete: z.boolean(),
  createdAt: z.number(),
  cookedCount: z.number(),
  lastCookedAt: z.number().nullable(),
  cooks: z.array(cooked),
});

export type Recipe = z.infer<typeof recipe>;

export const recipeList = z.array(recipe);

export const recipeFavorite = z.object({ isFavorite: z.boolean() });

export const recipeDeleted = deleted;
