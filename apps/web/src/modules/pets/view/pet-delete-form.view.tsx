import { reatomComponent } from "@reatom/react";
import type { FormEvent } from "react";

import { Button, FieldError, Section, TextField } from "@/common/ui";

import type { PetsScreenModel } from "../vm/pets.vm.ts";

type PetDeleteFormProps = { model: PetsScreenModel };

export const PetDeleteForm = reatomComponent(({ model }: PetDeleteFormProps) => {
  const isDeleting = model.isDeleting();

  function submit(event: FormEvent) {
    event.preventDefault();
    model.deletePet();
  }

  return (
    <Section footer="Удалятся карточка, памятка, журнал и траты питомца. Его планы останутся в «Планах» без привязки.">
      <form className="flex flex-col gap-3 p-4" onSubmit={submit}>
        <TextField
          field={model.deletion.fields.petName}
          id="deleted-pet-name"
          label="Введите имя питомца"
        />
        <FieldError>{model.deletionFailure()}</FieldError>
        <Button type="submit" variant="destructive" disabled={isDeleting}>
          {isDeleting ? "Удаляем…" : "Удалить навсегда"}
        </Button>
        <Button type="button" variant="ghost" onClick={model.back}>
          Отмена
        </Button>
      </form>
    </Section>
  );
}, "PetDeleteForm");
