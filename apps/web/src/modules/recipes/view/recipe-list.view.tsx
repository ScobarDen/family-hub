import { reatomComponent } from "@reatom/react";
import { CookingPot, Star, Tags } from "lucide-react";

import type { RecipeTag } from "@family-hub/contract";

import { PrimaryButton, Section, SectionItem, SectionLayout } from "@/common/ui";

import type { RecipeItem } from "../recipes.lib.ts";
import type { RecipesScreenModel } from "../vm/recipes.vm.ts";
import { RecipeFilters } from "./recipe-filters.view.tsx";

type RecipeListProps = {
  model: RecipesScreenModel;
  recipes: RecipeItem[];
  tags: RecipeTag[];
  summary: string;
};

function recipesOf({ model, recipes, tags }: RecipeListProps) {
  return (
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
      </Section>
    </>
  );
}

function tagsOf({ model, tags }: RecipeListProps) {
  return (
    <Section>
      {tags.map((tag) => (
        <SectionItem key={tag.id} title={tag.name} />
      ))}
      <SectionItem icon={Tags} title="Изменить теги" onClick={model.openTags} />
    </Section>
  );
}

export const RecipeList = reatomComponent(
  (props: RecipeListProps) => (
    <SectionLayout
      summary={<p className="px-5 pb-4 text-[0.9375rem] text-muted-foreground">{props.summary}</p>}
      action={<PrimaryButton onClick={props.model.add}>Добавить рецепт</PrimaryButton>}
      tabs={[
        { key: "recipes", title: "Рецепты", content: recipesOf(props) },
        { key: "tags", title: "Теги", content: tagsOf(props) },
      ]}
    />
  ),
  "RecipeList",
);
