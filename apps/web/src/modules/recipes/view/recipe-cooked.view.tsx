import { reatomComponent } from "@reatom/react";
import { Trash2 } from "lucide-react";

import { Button, Section, SectionItem } from "@/common/ui";

import type { RecipeDetails } from "../recipes.lib.ts";
import type { RecipesScreenModel } from "../vm/recipes.vm.ts";
import { CookForm } from "./cook-form.view.tsx";

type CookedProps = { model: RecipesScreenModel; recipe: RecipeDetails };

export const RecipeCooked = reatomComponent(
  ({ model, recipe }: CookedProps) => (
    <Section title="Приготовили" footer={recipe.cookedSummary}>
      <CookForm model={model} />
      {recipe.cooks.map((cooked) => (
        <SectionItem
          key={cooked.id}
          title={cooked.memberName}
          subtitle={cooked.day}
          after={
            cooked.isOwn && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Убрать отметку"
                onClick={() => {
                  model.uncook(cooked.id);
                }}
              >
                <Trash2 />
              </Button>
            )
          }
        />
      ))}
    </Section>
  ),
  "RecipeCooked",
);
