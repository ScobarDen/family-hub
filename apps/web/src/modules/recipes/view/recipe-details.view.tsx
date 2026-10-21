import { reatomComponent } from "@reatom/react";
import { Pencil, Star, Trash2 } from "lucide-react";

import type { Recipe } from "@family-hub/contract";

import { PhotoViewer } from "@/common/photo-viewer";
import { Section, SectionItem } from "@/common/ui";

import type { RecipesScreenModel } from "../vm/recipes.vm.ts";
import { RecipeIngredients } from "./recipe-ingredients.view.tsx";
import { RecipePhotos } from "./recipe-photos.view.tsx";

type DetailsProps = { model: RecipesScreenModel; recipe: Recipe; checked: number[] };

export const RecipeDetails = reatomComponent(
  ({ model, recipe, checked }: DetailsProps) => (
    <>
      <RecipePhotos
        photos={recipe.photos}
        onOpen={(photoId) => {
          model.viewer.open(recipe.photos, photoId);
        }}
      />
      <RecipeIngredients model={model} ingredients={recipe.ingredients} checked={checked} />
      {recipe.method !== null && (
        <Section title="Как готовить">
          <p className="px-4 py-3 whitespace-pre-line">{recipe.method}</p>
        </Section>
      )}
      <Section>
        <SectionItem
          icon={Star}
          tone="orange"
          title={recipe.isFavorite ? "Убрать из избранного" : "В избранное"}
          onClick={model.toggleFavorite}
        />
        <SectionItem icon={Pencil} tone="gray" title="Изменить рецепт" onClick={model.edit} />
        {recipe.canDelete && (
          <SectionItem icon={Trash2} tone="red" title="Удалить рецепт" onClick={model.remove} />
        )}
      </Section>
      <PhotoViewer model={model.viewer} />
    </>
  ),
  "RecipeDetails",
);
