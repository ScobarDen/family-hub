import { reatomComponent } from "@reatom/react";
import { Pencil, Star, Trash2 } from "lucide-react";

import { PhotoThumbs, PhotoViewer } from "@/common/photo-viewer";
import { Section, SectionItem } from "@/common/ui";

import type { RecipeDetails as RecipeDetailsData } from "../recipes.lib.ts";
import type { RecipesScreenModel } from "../vm/recipes.vm.ts";
import { RecipeCooked } from "./recipe-cooked.view.tsx";
import { RecipeIngredients } from "./recipe-ingredients.view.tsx";

type DetailsProps = { model: RecipesScreenModel; recipe: RecipeDetailsData; checked: number[] };

export const RecipeDetails = reatomComponent(
  ({ model, recipe, checked }: DetailsProps) => (
    <>
      <PhotoThumbs
        className="flex gap-1 overflow-x-auto px-4 pb-3"
        thumbClassName="size-28 rounded-lg"
        resolution="medium"
        photos={recipe.photos}
        onOpen={(photoId) => {
          model.viewer.open(recipe.photos, photoId);
        }}
      />
      <RecipeIngredients model={model} ingredients={recipe.ingredients} checked={checked} />
      <RecipeCooked model={model} recipe={recipe} />
      {recipe.method !== null && (
        <Section title="Как готовить">
          <p className="px-4 py-3 whitespace-pre-line">{recipe.method}</p>
        </Section>
      )}
      <Section>
        <SectionItem
          icon={Star}
          title={recipe.isFavorite ? "Убрать из избранного" : "В избранное"}
          onClick={model.toggleFavorite}
        />
        <SectionItem icon={Pencil} title="Изменить рецепт" onClick={model.edit} />
        {recipe.canDelete && (
          <SectionItem icon={Trash2} isAlert title="Удалить рецепт" onClick={model.remove} />
        )}
      </Section>
      <PhotoViewer model={model.viewer} />
    </>
  ),
  "RecipeDetails",
);
