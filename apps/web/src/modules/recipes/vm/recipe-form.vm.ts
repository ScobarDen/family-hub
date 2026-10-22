import { action, atom, computed, reatomForm, type Atom } from "@reatom/core";
import { z } from "zod";

import {
  recipeChange,
  recipePhotoMax,
  recipeTextMaxLength,
  recipeTitleMaxLength,
  type Recipe,
  type RecipeChange,
} from "@family-hub/contract";

import { reatomEditableRecord } from "@/common/form";
import type { PreparedPhoto } from "@/common/photo";
import { reatomPhotoAttachments } from "@/common/photo-attachments";
import { readOnly } from "@/common/state";

import type { RecipesApi } from "../recipes.api.ts";

type RecipeFormDependencies = {
  api: RecipesApi;
  preparePhoto: (file: Blob) => Promise<PreparedPhoto>;
  photoHint: () => string | undefined;
  onSaved: (saved: Recipe) => void;
};

const emptyRecipe = { title: "", ingredients: "", method: "" };

type RecipeValues = typeof emptyRecipe;

const tooLong = `Не длиннее ${recipeTextMaxLength} символов`;

const schema = z.object({
  title: z.string().trim().min(1, "Введите название").max(recipeTitleMaxLength, "Слишком длинно"),
  ingredients: z.string().max(recipeTextMaxLength, tooLong),
  method: z.string().max(recipeTextMaxLength, tooLong),
});

function valuesOf({ title, ingredients, method }: Recipe): RecipeValues {
  return { title, ingredients: ingredients.join("\n"), method: method ?? "" };
}

function reatomTagChoice(chosen: Atom<string[]>) {
  return action((tagId: string) => {
    const current = chosen();

    chosen.set(
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    );
  }, "recipes.form.toggleTag");
}

function reatomRecipeRecord(
  { api, onSaved }: RecipeFormDependencies,
  { chosenTags, photos }: { chosenTags: Atom<string[]>; photos: { photoIds: () => string[] } },
) {
  function changeOf(values: RecipeValues): RecipeChange {
    return recipeChange.parse({ ...values, tagIds: chosenTags(), photoIds: photos.photoIds() });
  }

  return reatomEditableRecord({
    name: "recipes.record",
    form: (onSubmit) => reatomForm(emptyRecipe, { name: "recipes.form", schema, onSubmit }),
    failureMessage: "Не получилось сохранить рецепт. Попробуйте ещё раз.",
    valuesOf,
    create: async (values) => api.create(changeOf(values)),
    update: async (recipe: Recipe, values) => api.update(recipe.id, changeOf(values)),
    onSaved,
  });
}

export function reatomRecipeForm(dependencies: RecipeFormDependencies) {
  const chosenTags = atom<string[]>([], "recipes.form.chosenTags");
  const photos = reatomPhotoAttachments({
    ...dependencies,
    max: recipePhotoMax,
    canUploadPhotos: () => dependencies.photoHint() === undefined,
  });
  const record = reatomRecipeRecord(dependencies, { chosenTags, photos });

  return {
    ...record,
    photos,
    chosenTags: readOnly(chosenTags),
    isSaving: computed(() => record.isSaving() || photos.isUploading(), "recipes.form.isSaving"),
    toggleTag: reatomTagChoice(chosenTags),

    startCreating: action(() => {
      chosenTags.set([]);
      photos.reset([]);
      record.startCreating(emptyRecipe);
    }, "recipes.form.startCreating"),
    startEditing: action((target: Recipe) => {
      chosenTags.set(target.tags.map(({ id }) => id));
      photos.reset(target.photos);
      record.startEditing(target);
    }, "recipes.form.startEditing"),
  };
}

export type RecipeFormModel = ReturnType<typeof reatomRecipeForm>;
