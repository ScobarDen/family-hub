import { reatomComponent } from "@reatom/react";

import { type Choice, ChoiceField, FormShell, TextAreaField, TextField } from "@/common/ui";

import { sexTitles, speciesTitles } from "../pets.config.ts";
import type { PetProfileFormModel } from "../vm/pet-profile-form.vm.ts";

type PetProfileFormProps = { model: PetProfileFormModel; onCancel: () => void };

const speciesChoices: Choice[] = Object.entries(speciesTitles).map(([value, title]) => ({
  value,
  title,
}));
const sexChoices: Choice[] = [
  { value: "", title: "Не указан" },
  ...Object.entries(sexTitles).map(([value, title]) => ({ value, title })),
];

export const PetProfileForm = reatomComponent(({ model, onCancel }: PetProfileFormProps) => {
  const { fields } = model.form;

  return (
    <FormShell model={model} onCancel={onCancel}>
      <TextField field={fields.name} id="pet-name" label="Имя" placeholder="Например, Бьюик" />
      <ChoiceField field={fields.species} label="Вид" choices={speciesChoices} />
      <TextField field={fields.breed} id="pet-breed" label="Порода" />
      <ChoiceField field={fields.sex} label="Пол" choices={sexChoices} />
      <TextField field={fields.birthDate} id="pet-birth-date" label="Дата рождения" type="date" />
      <TextField field={fields.chipNumber} id="pet-chip" label="Номер чипа" />
      <TextAreaField field={fields.notes} id="pet-notes" label="Заметки" />
    </FormShell>
  );
}, "PetProfileForm");
