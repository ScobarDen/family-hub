import { reatomComponent } from "@reatom/react";
import { Pencil, Share, Star, Trash2 } from "lucide-react";

import { PhotoThumbs, PhotoViewer } from "@/modules/photo-viewer";
import { Section, SectionItem, SectionLayout } from "@/modules/ui";

import type { RecipeDetails as RecipeDetailsData } from "../recipes.lib.ts";
import type { RecipesScreenModel } from "../vm/recipes.vm.ts";
import { RecipeIngredients } from "./recipe-ingredients.view.tsx";

type DetailsProps = { model: RecipesScreenModel; recipe: RecipeDetailsData; checked: number[] };

function tabsOf({ model, recipe, checked }: DetailsProps) {
  return [
    {
      key: "ingredients",
      title: "Ингредиенты",
      content: (
        <RecipeIngredients model={model} ingredients={recipe.ingredients} checked={checked} />
      ),
    },
    {
      key: "method",
      title: "Как готовить",
      content: (
        <Section>
          <p className="px-4 py-3 whitespace-pre-line">
            {recipe.method ?? "Способ приготовления не записан"}
          </p>
        </Section>
      ),
    },
  ];
}

const RecipeActions = reatomComponent(
  ({ model, recipe }: Omit<DetailsProps, "checked">) => (
    <Section>
      <SectionItem
        icon={Star}
        title={recipe.isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
        onClick={model.toggleFavorite}
      />
      {model.canShare && (
        <SectionItem
          icon={Share}
          title="Поделиться"
          disabled={model.isSharing()}
          onClick={model.share}
        />
      )}
      <SectionItem icon={Pencil} title="Изменить рецепт" onClick={model.edit} />
      {recipe.canDelete && (
        <SectionItem icon={Trash2} isDestructive title="Удалить рецепт" onClick={model.remove} />
      )}
    </Section>
  ),
  "RecipeActions",
);

export const RecipeDetails = reatomComponent((props: DetailsProps) => {
  const { model, recipe } = props;

  return (
    <>
      <SectionLayout
        summary={
          <PhotoThumbs
            className="flex gap-1 overflow-x-auto px-4 pb-3"
            thumbClassName="size-28 rounded-lg"
            resolution="medium"
            photos={recipe.photos}
            onOpen={(photoId) => {
              model.viewer.open(recipe.photos, photoId);
            }}
          />
        }
        tabs={tabsOf(props)}
      />
      <RecipeActions model={model} recipe={recipe} />
      <PhotoViewer model={model.viewer} />
    </>
  );
}, "RecipeDetails");
