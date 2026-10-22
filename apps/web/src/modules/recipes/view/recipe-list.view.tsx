import { reatomComponent } from "@reatom/react";
import { CookingPot, Plus, Star, Tags } from "lucide-react";

import type { RecipeTag } from "@family-hub/contract";

import { Section, SectionItem } from "@/common/ui";

import type { RecipeItem } from "../recipes.lib.ts";
import type { RecipesScreenModel } from "../vm/recipes.vm.ts";
import { RecipeFilters } from "./recipe-filters.view.tsx";

type RecipeListProps = { model: RecipesScreenModel; recipes: RecipeItem[]; tags: RecipeTag[] };

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
            title={recipe.title}
            subtitle={recipe.subtitle}
            onClick={() => {
              model.open(recipe.id);
            }}
          />
        ))}
        <SectionItem icon={Plus} title="Новый рецепт" onClick={model.add} />
        <SectionItem icon={Tags} title="Теги" onClick={model.openTags} />
      </Section>
    </>
  ),
  "RecipeList",
);
