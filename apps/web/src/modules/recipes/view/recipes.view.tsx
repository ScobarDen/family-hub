import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import { Section, SectionItem } from "@/common/ui";

import type { RecipesScreen, RecipesScreenModel } from "../vm/recipes.vm.ts";
import { RecipeDetails } from "./recipe-details.view.tsx";
import { RecipeForm } from "./recipe-form.view.tsx";
import { RecipeList } from "./recipe-list.view.tsx";
import { RecipeTags } from "./recipe-tags.view.tsx";

export type RecipesProps = {
  model: RecipesScreenModel;
  photoHint: string | undefined;
  timeZone: string;
};

function contentOf({ model, photoHint, timeZone }: RecipesProps, screen: RecipesScreen): ReactNode {
  if (screen.kind === "list") {
    return <RecipeList model={model} recipes={screen.recipes} tags={screen.tags} />;
  }

  if (screen.kind === "recipe") {
    return (
      <RecipeDetails
        model={model}
        recipe={screen.recipe}
        checked={screen.checked}
        timeZone={timeZone}
      />
    );
  }

  if (screen.kind === "form") {
    return (
      <RecipeForm
        model={model.form}
        tags={screen.tags}
        photoHint={photoHint}
        onCancel={model.back}
      />
    );
  }

  if (screen.kind === "tags") {
    return <RecipeTags model={model} tags={screen.tags} />;
  }

  return (
    <Section>
      <SectionItem
        title={screen.kind === "loading" ? "Загружаем…" : "Не получилось загрузить рецепты."}
      />
    </Section>
  );
}

export const Recipes = reatomComponent(
  (props: RecipesProps) => contentOf(props, props.model.screen()),
  "Recipes",
);
