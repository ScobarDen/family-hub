import { reatomComponent } from "@reatom/react";
import { Circle, CircleCheck } from "lucide-react";

import { Section, SectionItem } from "@/modules/ui";

import type { RecipesScreenModel } from "../vm/recipes.vm.ts";

type IngredientsProps = { model: RecipesScreenModel; ingredients: string[]; checked: number[] };

export const RecipeIngredients = reatomComponent(
  ({ model, ingredients, checked }: IngredientsProps) => (
    <Section footer="Отмечайте, что уже положили">
      {ingredients.length === 0 && <SectionItem title="Ингредиенты не записаны" />}
      {ingredients.map((ingredient, index) => (
        <SectionItem
          // Two lines of a recipe may read the same, so the position is the identity.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
          icon={checked.includes(index) ? CircleCheck : Circle}
          title={ingredient}
          isPressed={checked.includes(index)}
          onClick={() => {
            model.toggleIngredient(index);
          }}
        />
      ))}
    </Section>
  ),
  "RecipeIngredients",
);
