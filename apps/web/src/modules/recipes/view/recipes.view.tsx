import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import { LoadState } from "@/common/ui";

import type { RecipesScreen, RecipesScreenModel } from "../vm/recipes.vm.ts";
import { RecipeDetails } from "./recipe-details.view.tsx";
import { RecipeForm } from "./recipe-form.view.tsx";
import { RecipeList } from "./recipe-list.view.tsx";
import { RecipeTags } from "./recipe-tags.view.tsx";

export type RecipesProps = { model: RecipesScreenModel };

function contentOf({ model }: RecipesProps, screen: RecipesScreen): ReactNode {
  if (screen.kind === "list") {
    return (
      <RecipeList
        model={model}
        recipes={screen.recipes}
        tags={screen.tags}
        summary={screen.summary}
        empty={screen.empty}
      />
    );
  }

  if (screen.kind === "recipe") {
    return <RecipeDetails model={model} recipe={screen.recipe} checked={screen.checked} />;
  }

  if (screen.kind === "form") {
    return (
      <RecipeForm
        model={model.form}
        tags={screen.tags}
        photoHint={model.photoHint()}
        onCancel={model.back}
      />
    );
  }

  if (screen.kind === "tags") {
    return <RecipeTags model={model} tags={screen.tags} />;
  }

  return (
    <LoadState
      failure={screen.kind === "failed" ? "Не получилось загрузить рецепты." : undefined}
      onRetry={model.retry}
    />
  );
}

export const Recipes = reatomComponent(
  (props: RecipesProps) => contentOf(props, props.model.screen()),
  "Recipes",
);
