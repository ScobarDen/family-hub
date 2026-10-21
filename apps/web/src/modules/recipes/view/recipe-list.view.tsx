import { reatomComponent } from "@reatom/react";
import { CookingPot, Plus, Star, Tags } from "lucide-react";

import type { Recipe, RecipeTag } from "@family-hub/contract";

import { Section, SectionItem } from "@/common/ui";

import type { RecipesScreenModel } from "../vm/recipes.vm.ts";
import { RecipeFilters } from "./recipe-filters.view.tsx";

type RecipeListProps = { model: RecipesScreenModel; recipes: Recipe[]; tags: RecipeTag[] };

export const RecipeList = reatomComponent(
  ({ model, recipes, tags }: RecipeListProps) => (
    <>
      <RecipeFilters model={model} tags={tags} />
      <Section>
        {recipes.length === 0 && <SectionItem title="Ничего не нашлось" />}
        {recipes.map((recipe) => (
          <SectionItem
            key={recipe.id}
            icon={recipe.isFavorite ? Star : CookingPot}
            tone={recipe.isFavorite ? "orange" : "pink"}
            title={recipe.title}
            subtitle={recipe.tags.map(({ name }) => name).join(" · ") || undefined}
            onClick={() => {
              model.open(recipe.id);
            }}
          />
        ))}
        <SectionItem icon={Plus} tone="green" title="Новый рецепт" onClick={model.add} />
        <SectionItem icon={Tags} tone="gray" title="Теги" onClick={model.openTags} />
      </Section>
    </>
  ),
  "RecipeList",
);
