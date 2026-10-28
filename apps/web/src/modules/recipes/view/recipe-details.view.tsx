import { reatomComponent } from "@reatom/react";
import { Pencil, Share, Star, Trash2 } from "lucide-react";

import { PhotoThumbs, PhotoViewer } from "@/common/photo-viewer";
import { Section, SectionItem, SectionLayout } from "@/common/ui";

import type { RecipeDetails as RecipeDetailsData } from "../recipes.lib.ts";
import type { RecipesScreenModel } from "../vm/recipes.vm.ts";
import { CookForm } from "./cook-form.view.tsx";
import { RecipeCooked } from "./recipe-cooked.view.tsx";
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
    { key: "cooked", title: "История", content: <RecipeCooked model={model} recipe={recipe} /> },
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
            <p className="px-5 pb-4 text-[0.9375rem] text-muted-foreground">
              {recipe.cookedSummary}
            </p>
          </>
        }
        action={<CookForm model={model} />}
        tabs={tabsOf(props)}
      />
      <RecipeActions model={model} recipe={recipe} />
      <PhotoViewer model={model.viewer} />
    </>
  );
}, "RecipeDetails");
