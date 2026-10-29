import { reatomComponent } from "@reatom/react";
import { Plus } from "lucide-react";
import type { FormEvent } from "react";

import type { RecipeTag } from "@family-hub/contract";

import { Button, FieldError, Input, Section } from "@/modules/ui";

import type { RecipesScreenModel } from "../vm/recipes.vm.ts";
import { TagRow } from "./tag-row.view.tsx";

type RecipeTagsProps = { model: RecipesScreenModel; tags: RecipeTag[] };

export const RecipeTags = reatomComponent(({ model, tags }: RecipeTagsProps) => {
  function add(event: FormEvent) {
    event.preventDefault();
    model.addTag();
  }

  return (
    <>
      <Section>
        {tags.map((tag) => (
          <TagRow key={tag.id} model={model} tag={tag} />
        ))}
      </Section>
      <form className="flex gap-2 px-4" onSubmit={add}>
        <Input
          placeholder="Новый тег"
          aria-label="Новый тег"
          value={model.newTag()}
          onChange={(event) => {
            model.typeNewTag(event.target.value);
          }}
        />
        <Button type="submit" size="icon" aria-label="Добавить тег">
          <Plus />
        </Button>
      </form>
      <FieldError className="px-4 pt-2">{model.tagFailure()}</FieldError>
    </>
  );
}, "RecipeTags");
