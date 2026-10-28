import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import {
  FailureBar,
  FormDrawer,
  LoadState,
  Revealed,
  SkeletonSection,
  SkeletonSectionLayout,
} from "@/common/ui";

import type { RecipesScreen, RecipesScreenModel } from "../vm/recipes.vm.ts";
import { RecipeDetails } from "./recipe-details.view.tsx";
import { RecipeFilters } from "./recipe-filters.view.tsx";
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

  if (screen.kind === "tags") {
    return <RecipeTags model={model} tags={screen.tags} />;
  }

  if (screen.kind === "loading") {
    return (
      <SkeletonSectionLayout tabs={2}>
        <RecipeFilters model={model} tags={[]} />
        <SkeletonSection rows={5} />
      </SkeletonSectionLayout>
    );
  }

  return <LoadState failure="Не получилось загрузить рецепты." onRetry={model.retry} />;
}

export const Recipes = reatomComponent((props: RecipesProps) => {
  const screen = props.model.screen();

  return (
    <>
      <Revealed isSkeleton={screen.kind === "loading"}>{contentOf(props, screen)}</Revealed>
      <FormDrawer
        open={props.model.isFormOpen()}
        title={props.model.formTitle()}
        onClose={props.model.back}
      >
        <RecipeForm
          model={props.model.form}
          tags={props.model.formTags()}
          photoHint={props.model.photoHint()}
          onCancel={props.model.back}
        />
      </FormDrawer>
      <FailureBar failure={props.model.failure()} onDismiss={props.model.dismissFailure} />
    </>
  );
}, "Recipes");
