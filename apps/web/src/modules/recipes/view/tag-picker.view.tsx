import { reatomComponent } from "@reatom/react";

import type { RecipeTag } from "@family-hub/contract";

import { Chip, ChipGroup } from "@/common/ui";

import type { RecipeFormModel } from "../vm/recipe-form.vm.ts";

export const TagPicker = reatomComponent(
  ({ model, tags }: { model: RecipeFormModel; tags: RecipeTag[] }) =>
    tags.length === 0 ? null : (
      <ChipGroup label="Теги">
        {tags.map((tag) => (
          <Chip
            key={tag.id}
            isSelected={model.chosenTags().includes(tag.id)}
            onClick={() => {
              model.toggleTag(tag.id);
            }}
          >
            {tag.name}
          </Chip>
        ))}
      </ChipGroup>
    ),
  "TagPicker",
);
