import type { FieldAtom } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import type { FormEvent } from "react";

import { Button, Chip, FieldError, Label, TextAreaField, TextField } from "@/common/ui";

import { sexTitles, speciesTitles } from "../pets.config.ts";
import type { PetProfileFormModel } from "../vm/pet-profile-form.vm.ts";

type PetProfileFormProps = { model: PetProfileFormModel; onCancel: () => void };

type ChoiceProps = {
  field: FieldAtom<string, string>;
  label: string;
  options: Array<[value: string, title: string]>;
};

const speciesOptions = Object.entries(speciesTitles);
const sexOptions: Array<[string, string]> = [["", "Не указан"], ...Object.entries(sexTitles)];

const Choice = reatomComponent(({ field, label, options }: ChoiceProps) => {
  const selected = field();

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map(([value, title]) => (
          <Chip
            key={value}
            isSelected={value === selected}
            onClick={() => {
              field.set(value);
            }}
          >
            {title}
          </Chip>
        ))}
      </div>
    </div>
  );
}, "Choice");

export const PetProfileForm = reatomComponent(({ model, onCancel }: PetProfileFormProps) => {
  const { fields } = model.form;
  const isSaving = model.isSaving();

  function submit(event: FormEvent) {
    event.preventDefault();
    model.save();
  }

  return (
    <form className="flex flex-col gap-4 px-4 pb-6" onSubmit={submit}>
      <TextField field={fields.name} id="pet-name" label="Имя" placeholder="Например, Бьюик" />
      <Choice field={fields.species} label="Вид" options={speciesOptions} />
      <TextField field={fields.breed} id="pet-breed" label="Порода" />
      <Choice field={fields.sex} label="Пол" options={sexOptions} />
      <TextField field={fields.birthDate} id="pet-birth-date" label="Дата рождения" type="date" />
      <TextField field={fields.chipNumber} id="pet-chip" label="Номер чипа" />
      <TextAreaField field={fields.notes} id="pet-notes" label="Заметки" />
      <FieldError>{model.failure()}</FieldError>
      <Button type="submit" size="lg" disabled={isSaving}>
        {isSaving ? "Сохраняем…" : "Сохранить"}
      </Button>
      <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
        Отмена
      </Button>
    </form>
  );
}, "PetProfileForm");
