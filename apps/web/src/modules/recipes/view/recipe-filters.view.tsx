import { reatomComponent } from "@reatom/react";
import { Star } from "lucide-react";

import type { RecipeTag } from "@family-hub/contract";

import { Chip, Input } from "@/common/ui";

import type { RecipesScreenModel } from "../vm/recipes.vm.ts";

export const RecipeFilters = reatomComponent(
  ({ model, tags }: { model: RecipesScreenModel; tags: RecipeTag[] }) => (
    <div className="flex flex-col gap-2 px-4 pb-2">
      <Input
        type="search"
        placeholder="Искать в рецептах"
        aria-label="Поиск рецептов"
        value={model.text()}
        onChange={(event) => {
          model.search(event.target.value);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Chip isSelected={model.isFavorite()} onClick={model.toggleFavorites}>
          <Star className="size-4" /> Избранное
        </Chip>
        {tags.map((tag) => (
          <Chip
            key={tag.id}
            isSelected={model.tagId() === tag.id}
            onClick={() => {
              model.chooseTag(tag.id);
            }}
          >
            {tag.name}
          </Chip>
        ))}
      </div>
    </div>
  ),
  "RecipeFilters",
);
