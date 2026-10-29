import { reatomComponent } from "@reatom/react";
import { useEffect, type FormEvent, type ReactNode } from "react";

import { careKindTitles } from "@family-hub/contract";

import {
  Button,
  ChoiceField,
  FieldError,
  PickerField,
  TextAreaField,
  TextField,
  useFocusOnInvalid,
  type Choice,
} from "@/modules/ui";

import type { CareFormModel } from "../vm/care-form.vm.ts";

type CareFormProps = {
  model: CareFormModel;
  photos: ReactNode;
  isReadOnly: boolean;
  onCancel: () => void;
  onRemove: () => void;
};

type ActionsProps = Omit<CareFormProps, "photos">;

const kindChoices: Choice[] = Object.entries(careKindTitles).map(([value, title]) => ({
  value,
  title,
}));

const KindFields = reatomComponent(({ model }: { model: CareFormModel }) => {
  const { fields } = model.form;

  return model.kindFields().map(({ name, label, placeholder, inputMode, type, choices }) => {
    if (type === "date") {
      return (
        <PickerField key={name} field={fields[name]} id={`care-${name}`} label={label} isOptional />
      );
    }

    if (choices !== undefined) {
      return <ChoiceField key={name} field={fields[name]} label={label} choices={choices} />;
    }

    return (
      <TextField
        key={name}
        field={fields[name]}
        id={`care-${name}`}
        label={label}
        {...(placeholder === undefined ? {} : { placeholder })}
        {...(inputMode === undefined ? {} : { inputMode })}
      />
    );
  });
}, "KindFields");

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
      <Button type="submit" size="lg" isPending={isSaving}>
        Сохранить
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

  const form = useFocusOnInvalid(model.form.submit.error());

  useEffect(() => model.confirmClosingWhileDirty(), [model]);

  function submit(event: FormEvent) {
    event.preventDefault();
    model.save();
  }

  return (
    <form ref={form} className="flex flex-col gap-4 px-5 pb-6" onSubmit={submit}>
      <fieldset className="flex min-w-0 flex-col gap-4" disabled={isReadOnly}>
        <ChoiceField field={fields.kind} label="Что записать" choices={kindChoices} />
        <PickerField kind="datetime-local" field={fields.occurredAt} id="care-time" label="Когда" />
        <KindFields model={model} />
        <TextAreaField field={fields.note} id="care-note" label="Заметка" />
        {photos}
      </fieldset>
      <FieldError>{model.failure()}</FieldError>
      <Actions {...props} />
    </form>
  );
}, "CareForm");
