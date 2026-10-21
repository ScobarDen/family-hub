import { reatomComponent } from "@reatom/react";
import type { FormEvent } from "react";

import { Button, FieldError, TextAreaField } from "@/common/ui";

import type { PetMemoFormModel } from "../vm/pet-memo-form.vm.ts";

type PetMemoFormProps = { model: PetMemoFormModel; onCancel: () => void };

export const PetMemoForm = reatomComponent(({ model, onCancel }: PetMemoFormProps) => {
  const { fields } = model.form;
  const isSaving = model.isSaving();

  function submit(event: FormEvent) {
    event.preventDefault();
    model.save();
  }

  return (
    <form className="flex flex-col gap-4 px-4 pb-6" onSubmit={submit}>
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
      <FieldError>{model.failure()}</FieldError>
      <Button type="submit" size="lg" disabled={isSaving}>
        {isSaving ? "Сохраняем…" : "Сохранить"}
      </Button>
      <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
        Отмена
      </Button>
    </form>
  );
}, "PetMemoForm");
