import { reatomComponent } from "@reatom/react";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import type { RecipeTag } from "@family-hub/contract";

import { Button, FieldError, Input, Section } from "@/common/ui";

import type { RecipesScreenModel } from "../vm/recipes.vm.ts";
import { TagRow } from "./tag-row.view.tsx";

type RecipeTagsProps = { model: RecipesScreenModel; tags: RecipeTag[] };

export const RecipeTags = reatomComponent(({ model, tags }: RecipeTagsProps) => {
  const [draft, setDraft] = useState("");

  function add(event: FormEvent) {
    event.preventDefault();
    model.addTag(draft);
    setDraft("");
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
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
        <Button type="submit" size="icon" aria-label="Добавить тег">
          <Plus />
        </Button>
      </form>
      <div className="px-4 pt-2">
        <FieldError>{model.tagFailure()}</FieldError>
      </div>
    </>
  );
}, "RecipeTags");
