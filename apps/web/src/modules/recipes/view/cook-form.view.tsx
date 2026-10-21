import { reatomComponent } from "@reatom/react";
import { CookingPot } from "lucide-react";
import { useState } from "react";

import { Button, Input } from "@/common/ui";

import type { RecipesScreenModel } from "../vm/recipes.vm.ts";

// Today by default; an earlier day marks a dinner cooked before it was written down.
export const CookForm = reatomComponent(({ model }: { model: RecipesScreenModel }) => {
  const [date, setDate] = useState(model.today());

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <Input
        type="date"
        aria-label="Когда приготовили"
        className="w-40"
        max={model.today()}
        value={date}
        onChange={(event) => {
          setDate(event.target.value);
        }}
      />
      <Button
        disabled={model.isCooking() || date === ""}
        onClick={() => {
          model.cook(date);
        }}
      >
        <CookingPot /> Приготовили
      </Button>
    </div>
  );
}, "CookForm");
