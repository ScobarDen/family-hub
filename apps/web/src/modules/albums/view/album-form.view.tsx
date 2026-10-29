import { reatomComponent } from "@reatom/react";

import { FormShell, TextAreaField, TextField } from "@/modules/ui";

import type { AlbumFormModel } from "../vm/album-form.vm.ts";

type AlbumFormProps = { model: AlbumFormModel; onCancel: () => void };

export const AlbumForm = reatomComponent(({ model, onCancel }: AlbumFormProps) => {
  const { fields } = model.form;

  return (
    <FormShell model={model} onCancel={onCancel}>
      <TextField field={fields.title} id="album-title" label="Название" placeholder="Казань" />
      <TextAreaField field={fields.description} id="album-description" label="Описание" />
    </FormShell>
  );
}, "AlbumForm");
