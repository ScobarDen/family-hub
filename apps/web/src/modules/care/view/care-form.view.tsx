import { reatomComponent } from "@reatom/react";
import type { FormEvent, ReactNode } from "react";

import type { CareKind } from "@family-hub/contract";

import {
  Button,
  ChoiceField,
  FieldError,
  TextAreaField,
  TextField,
  type Choice,
} from "@/common/ui";

import { categoryTitles, kindTitles } from "../care.config.ts";
import type { CareFormModel } from "../vm/care-form.vm.ts";

type CareFormProps = {
  model: CareFormModel;
  photos: ReactNode;
  isReadOnly: boolean;
  onCancel: () => void;
  onRemove: () => void;
};

type ActionsProps = Omit<CareFormProps, "photos">;

type Fields = CareFormModel["form"]["fields"];

const kindChoices: Choice[] = Object.entries(kindTitles).map(([value, title]) => ({
  value,
  title,
}));
const categoryChoices: Choice[] = Object.entries(categoryTitles).map(([value, title]) => ({
  value,
  title,
}));
const costChoices: Choice[] = [
  { value: "vet", title: categoryTitles.vet },
  { value: "medicine", title: categoryTitles.medicine },
];
const nameLabels: Partial<Record<CareKind, string>> = {
  vaccination: "Вакцина",
  treatment: "От чего",
};

function MedicalFields({ fields, kind }: { fields: Fields; kind: CareKind }) {
  const nameLabel = nameLabels[kind];

  return (
    <>
      {nameLabel !== undefined && (
        <TextField field={fields.name} id="care-name" label={nameLabel} />
      )}
      {kind === "treatment" && (
        <TextField field={fields.product} id="care-product" label="Препарат" />
      )}
      {kind === "vet_visit" && <TextField field={fields.reason} id="care-reason" label="Причина" />}
      <TextField field={fields.costAmount} id="care-cost" label="Стоимость, ₽" />
      <ChoiceField field={fields.costCategory} label="Стоимость — это" choices={costChoices} />
      <TextField field={fields.dueDate} id="care-due-date" label="Повторить до" type="date" />
    </>
  );
}

function kindFields(fields: Fields, kind: CareKind): ReactNode {
  if (kind === "weight") {
    return (
      <TextField field={fields.weightKg} id="care-weight" label="Вес, кг" placeholder="12,4" />
    );
  }

  if (kind === "expense") {
    return (
      <>
        <TextField field={fields.amount} id="care-amount" label="Сумма, ₽" />
        <ChoiceField field={fields.category} label="Категория" choices={categoryChoices} />
      </>
    );
  }

  return kind === "note" ? undefined : <MedicalFields fields={fields} kind={kind} />;
}

const Actions = reatomComponent(({ model, isReadOnly, onCancel, onRemove }: ActionsProps) => {
  const isSaving = model.isSaving();

  if (isReadOnly) {
    return (
      <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
        Закрыть
      </Button>
    );
  }

  return (
    <>
      <Button type="submit" size="lg" disabled={isSaving}>
        {isSaving ? "Сохраняем…" : "Сохранить"}
      </Button>
      {model.editedId() !== undefined && (
        <Button type="button" size="lg" variant="destructive" onClick={onRemove}>
          Удалить запись
        </Button>
      )}
      <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
        Отмена
      </Button>
    </>
  );
}, "CareFormActions");

// An archived Pet's entry opens to read: the fieldset switches every input and chip off at once.
export const CareForm = reatomComponent(({ photos, ...props }: CareFormProps) => {
  const { model, isReadOnly } = props;
  const { fields } = model.form;

  function submit(event: FormEvent) {
    event.preventDefault();
    model.save();
  }

  return (
    <form className="flex flex-col gap-4 px-4 pb-6" onSubmit={submit}>
      <fieldset className="flex min-w-0 flex-col gap-4" disabled={isReadOnly}>
        <ChoiceField field={fields.kind} label="Что записать" choices={kindChoices} />
        <TextField field={fields.occurredAt} id="care-time" label="Когда" type="datetime-local" />
        {kindFields(fields, model.kind())}
        <TextAreaField field={fields.note} id="care-note" label="Заметка" />
        {photos}
      </fieldset>
      <FieldError>{model.failure()}</FieldError>
      <Actions {...props} />
    </form>
  );
}, "CareForm");
