import { reatomComponent } from "@reatom/react";
import { Circle, CircleCheck } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import type { RecipesScreenModel } from "../vm/recipes.vm.ts";

type IngredientsProps = { model: RecipesScreenModel; ingredients: string[]; checked: number[] };

export const RecipeIngredients = reatomComponent(
  ({ model, ingredients, checked }: IngredientsProps) => (
    <Section title="Ингредиенты" footer="Отмечайте, что уже положили">
      {ingredients.length === 0 && <SectionItem title="Ингредиенты не записаны" />}
      {ingredients.map((ingredient, index) => (
        <SectionItem
          key={ingredient}
          icon={checked.includes(index) ? CircleCheck : Circle}
          tone={checked.includes(index) ? "green" : "gray"}
          title={ingredient}
          onClick={() => {
            model.toggleIngredient(index);
          }}
        />
      ))}
    </Section>
  ),
  "RecipeIngredients",
);
