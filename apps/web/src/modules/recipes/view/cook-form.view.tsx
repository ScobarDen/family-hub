import { reatomComponent } from "@reatom/react";
import { CookingPot } from "lucide-react";

import { Button, PickerInput } from "@/common/ui";

import type { RecipesScreenModel } from "../vm/recipes.vm.ts";

export const CookForm = reatomComponent(
  ({ model }: { model: RecipesScreenModel }) => (
    <div className="flex items-center gap-2">
      <PickerInput
        kind="date"
        aria-label="Когда приготовили"
        className="flex-1"
        max={model.today()}
        value={model.cookDay()}
        onValueChange={model.chooseCookDay}
      />
      <Button className="shrink-0" disabled={!model.canCook()} onClick={model.cook}>
        <CookingPot /> Приготовили
      </Button>
    </div>
  ),
  "CookForm",
);
