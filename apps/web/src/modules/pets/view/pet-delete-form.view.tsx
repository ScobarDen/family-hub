import { reatomComponent } from "@reatom/react";

import { ConfirmDeletionForm } from "@/common/ui";

import type { PetsScreenModel } from "../vm/pets.vm.ts";

export const PetDeleteForm = reatomComponent(
  ({ model }: { model: PetsScreenModel }) => (
    <ConfirmDeletionForm
      warning="Удалятся карточка, памятка, журнал и траты питомца. Его дела останутся в «Делах» без привязки."
      field={model.deletion.fields.petName}
      id="deleted-pet-name"
      label="Введите имя питомца"
      failure={model.deletionFailure()}
      isDeleting={model.isDeleting()}
      onDelete={model.deletePet}
      onCancel={model.back}
    />
  ),
  "PetDeleteForm",
);
