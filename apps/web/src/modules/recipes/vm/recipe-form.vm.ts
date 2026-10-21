import { action, atom, computed, noop, reatomForm, wrap, type Atom } from "@reatom/core";
import { z } from "zod";

import {
  recipeChange,
  recipePhotoMax,
  recipeTextMaxLength,
  recipeTitleMaxLength,
  type Recipe,
} from "@family-hub/contract";

import { fillForm, reatomSubmitFailure } from "@/common/form";
import type { PreparedPhoto } from "@/common/photo";
import { reatomPhotoAttachments } from "@/common/photo-attachments";

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

type RecipeForm = ReturnType<typeof reatomForm<RecipeValues>>;

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

function reatomRecipeSubmit(
  { api, onSaved }: RecipeFormDependencies,
  {
    edited,
    chosenTags,
    photos,
  }: {
    edited: Atom<Recipe | undefined>;
    chosenTags: Atom<string[]>;
    photos: { photoIds: () => string[] };
  },
): RecipeForm {
  return reatomForm(emptyRecipe, {
    name: "recipes.form",
    schema,
    onSubmit: async (values: RecipeValues) => {
      const target = edited();
      const change = recipeChange.parse({
        ...values,
        tagIds: chosenTags(),
        photoIds: photos.photoIds(),
      });
      const saved = await wrap(
        target === undefined ? api.create(change) : api.update(target.id, change),
      );

      onSaved(saved);
    },
  });
}

export function reatomRecipeForm(dependencies: RecipeFormDependencies) {
  const edited = atom<Recipe | undefined>(undefined, "recipes.form.edited");
  const chosenTags = atom<string[]>([], "recipes.form.chosenTags");
  const photos = reatomPhotoAttachments({
    ...dependencies,
    max: recipePhotoMax,
    canUploadPhotos: () => dependencies.photoHint() === undefined,
  });
  const form = reatomRecipeSubmit(dependencies, { edited, chosenTags, photos });

  return {
    form,
    photos,
    chosenTags: computed(() => chosenTags(), "recipes.form.tags"),
    isCreating: computed(() => edited() === undefined, "recipes.form.isCreating"),
    isSaving: computed(() => !form.submit.ready() || photos.isUploading(), "recipes.form.isSaving"),
    failure: reatomSubmitFailure(form, {
      message: "Не получилось сохранить рецепт. Попробуйте ещё раз.",
      name: "recipes.form.failure",
    }),
    toggleTag: reatomTagChoice(chosenTags),

    startCreating: action(() => {
      edited.set(undefined);
      chosenTags.set([]);
      photos.reset([]);
      fillForm(form, emptyRecipe);
    }, "recipes.form.startCreating"),
    startEditing: action((target: Recipe) => {
      edited.set(target);
      chosenTags.set(target.tags.map(({ id }) => id));
      photos.reset(target.photos);
      fillForm(form, valuesOf(target));
    }, "recipes.form.startEditing"),
    save: action(() => {
      form.submit().catch(noop);
    }, "recipes.form.save"),
  };
}

export type RecipeFormModel = ReturnType<typeof reatomRecipeForm>;
