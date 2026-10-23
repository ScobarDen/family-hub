import { reatomComponent } from "@reatom/react";
import { CookingPot } from "lucide-react";

import { Button, Input } from "@/common/ui";

import type { RecipesScreenModel } from "../vm/recipes.vm.ts";

export const CookForm = reatomComponent(
  ({ model }: { model: RecipesScreenModel }) => (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        aria-label="Когда приготовили"
        className="h-11 w-40"
        max={model.today()}
        value={model.cookDay()}
        onChange={(event) => {
          model.chooseCookDay(event.target.value);
        }}
      />
      <Button className="h-11 flex-1" disabled={!model.canCook()} onClick={model.cook}>
        <CookingPot /> Приготовили
      </Button>
    </div>
  ),
  "CookForm",
);
