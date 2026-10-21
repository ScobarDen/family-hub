import { reatomComponent } from "@reatom/react";
import type { FormEvent } from "react";

import { Button, FieldError, TextAreaField, TextField } from "@/common/ui";

import type { AlbumFormModel } from "../vm/album-form.vm.ts";

type AlbumFormProps = { model: AlbumFormModel; onCancel: () => void };

export const AlbumForm = reatomComponent(({ model, onCancel }: AlbumFormProps) => {
  const { fields } = model.form;

  function submit(event: FormEvent) {
    event.preventDefault();
    model.save();
  }

  return (
    <form className="flex flex-col gap-4 px-4 pb-6" onSubmit={submit}>
      <TextField field={fields.title} id="album-title" label="Название" placeholder="Казань" />
      <TextAreaField field={fields.description} id="album-description" label="Описание" />
      <FieldError>{model.failure()}</FieldError>
      <Button type="submit" size="lg" disabled={model.isSaving()}>
        {model.isSaving() ? "Сохраняем…" : "Сохранить"}
      </Button>
      <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
        Отмена
      </Button>
    </form>
  );
}, "AlbumForm");
