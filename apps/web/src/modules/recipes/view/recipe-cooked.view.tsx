import { reatomComponent } from "@reatom/react";
import { Trash2 } from "lucide-react";

import type { Recipe } from "@family-hub/contract";

import { formatDay } from "@/common/format-date";
import { Button, Section, SectionItem } from "@/common/ui";

import type { RecipesScreenModel } from "../vm/recipes.vm.ts";
import { CookForm } from "./cook-form.view.tsx";

type CookedProps = { model: RecipesScreenModel; recipe: Recipe; timeZone: string };

function summaryOf({ cookedCount, lastCookedAt }: Recipe, timeZone: string): string {
  return lastCookedAt === null
    ? "Ещё не готовили"
    : `Готовили ${cookedCount} раз · последний раз ${formatDay(lastCookedAt, timeZone)}`;
}

export const RecipeCooked = reatomComponent(
  ({ model, recipe, timeZone }: CookedProps) => (
    <Section title="Приготовили" footer={summaryOf(recipe, timeZone)}>
      <CookForm model={model} />
      {recipe.cooks.map((cooked) => (
        <SectionItem
          key={cooked.id}
          title={cooked.memberName}
          subtitle={formatDay(cooked.at, timeZone)}
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
