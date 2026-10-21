import { reatomComponent } from "@reatom/react";

import type { RecipeTag } from "@family-hub/contract";

import { Chip, Label } from "@/common/ui";

import type { RecipeFormModel } from "../vm/recipe-form.vm.ts";

export const TagPicker = reatomComponent(
  ({ model, tags }: { model: RecipeFormModel; tags: RecipeTag[] }) =>
    tags.length === 0 ? null : (
      <div className="flex flex-col gap-2">
        <Label>Теги</Label>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>
    ),
  "TagPicker",
);
