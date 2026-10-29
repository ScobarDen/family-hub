import { reatomComponent } from "@reatom/react";

import { FormShell, TextAreaField } from "@/modules/ui";

import { memoFields } from "../pets.config.ts";
import type { PetMemoFormModel } from "../vm/pet-memo-form.vm.ts";

type PetMemoFormProps = { model: PetMemoFormModel; onCancel: () => void };

export const PetMemoForm = reatomComponent(
  ({ model, onCancel }: PetMemoFormProps) => (
    <FormShell model={model} onCancel={onCancel}>
      {memoFields.map(({ key, label, placeholder }) => (
        <TextAreaField
          key={key}
          field={model.form.fields[key]}
          id={`memo-${key}`}
          label={label}
          placeholder={placeholder}
        />
      ))}
    </FormShell>
  ),
  "PetMemoForm",
);
