import { reatomComponent } from "@reatom/react";
import type { FormEvent } from "react";

import type { RecipeTag } from "@family-hub/contract";

import { PhotoAttachments } from "@/common/photo-attachments";
import { Button, FieldError, TextAreaField, TextField } from "@/common/ui";

import type { RecipeFormModel } from "../vm/recipe-form.vm.ts";
import { TagPicker } from "./tag-picker.view.tsx";

type RecipeFormProps = {
  model: RecipeFormModel;
  tags: RecipeTag[];
  photoHint: string | undefined;
  onCancel: () => void;
};

export const RecipeForm = reatomComponent(
  ({ model, tags, photoHint, onCancel }: RecipeFormProps) => {
    const { fields } = model.form;

    function submit(event: FormEvent) {
      event.preventDefault();
      model.save();
    }

    return (
      <form className="flex flex-col gap-4 px-4 pb-6" onSubmit={submit}>
        <TextField field={fields.title} id="recipe-title" label="Название" placeholder="Лазанья" />
        <TextAreaField
          field={fields.ingredients}
          id="recipe-ingredients"
          label="Ингредиенты — по одному в строке"
        />
        <TextAreaField field={fields.method} id="recipe-method" label="Как готовить" />
        <TagPicker model={model} tags={tags} />
        <PhotoAttachments model={model.photos} hint={photoHint} />
        <FieldError>{model.failure()}</FieldError>
        <Button type="submit" size="lg" disabled={model.isSaving()}>
          {model.isSaving() ? "Сохраняем…" : "Сохранить"}
        </Button>
        <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </form>
    );
  },
  "RecipeForm",
);
