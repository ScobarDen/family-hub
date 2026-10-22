import { reatomComponent } from "@reatom/react";

import { FormShell, TextAreaField } from "@/common/ui";

import type { PetMemoFormModel } from "../vm/pet-memo-form.vm.ts";

type PetMemoFormProps = { model: PetMemoFormModel; onCancel: () => void };

export const PetMemoForm = reatomComponent(({ model, onCancel }: PetMemoFormProps) => {
  const { fields } = model.form;

  return (
    <FormShell model={model} onCancel={onCancel}>
      <TextAreaField
        field={fields.food}
        id="memo-food"
        label="Корм сейчас"
        placeholder="Что и сколько раз в день"
      />
      <TextAreaField
        field={fields.clinic}
        id="memo-clinic"
        label="Ветклиника"
        placeholder="Адрес, телефон, врач"
      />
      <TextAreaField
        field={fields.important}
        id="memo-important"
        label="Важное"
        placeholder="Аллергии, страхи, привычки"
      />
    </FormShell>
  );
}, "PetMemoForm");
