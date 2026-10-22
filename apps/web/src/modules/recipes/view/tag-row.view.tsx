import { reatomComponent } from "@reatom/react";
import { Trash2 } from "lucide-react";

import type { RecipeTag } from "@family-hub/contract";

import { Button, Input } from "@/common/ui";

import type { RecipesScreenModel } from "../vm/recipes.vm.ts";

// A tag is renamed in place: the new name is saved when the field loses focus.
export const TagRow = reatomComponent(
  ({ model, tag }: { model: RecipesScreenModel; tag: RecipeTag }) => (
    <div className="flex items-center gap-2 px-4 py-1">
      <Input
        aria-label="Название тега"
        value={model.tagNameOf(tag)}
        onChange={(event) => {
          model.typeTagName(tag.id, event.target.value);
        }}
        onBlur={() => {
          model.renameTag(tag.id);
        }}
      />
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Удалить тег"
        onClick={() => {
          model.removeTag(tag.id);
        }}
      >
        <Trash2 />
      </Button>
    </div>
  ),
  "TagRow",
);
