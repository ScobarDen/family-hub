import { reatomComponent } from "@reatom/react";
import type { FormEvent } from "react";

import {
  Button,
  ChoiceField,
  FieldError,
  TextAreaField,
  TextField,
  type Choice,
} from "@/common/ui";

import type { PlanFormModel } from "../vm/plan-form.vm.ts";
import type { SubplanFormModel } from "../vm/subplan-form.vm.ts";

const visibilityChoices: Choice[] = [
  { value: "shared", title: "Для всей семьи" },
  { value: "private", title: "Только я" },
];

type FormButtonsProps = { isSaving: boolean; onCancel: () => void };

function FormButtons({ isSaving, onCancel }: FormButtonsProps) {
  return (
    <>
      <Button type="submit" size="lg" disabled={isSaving}>
        {isSaving ? "Сохраняем…" : "Сохранить"}
      </Button>
      <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
        Отмена
      </Button>
    </>
  );
}

function submitWith(save: () => void) {
  return (event: FormEvent) => {
    event.preventDefault();
    save();
  };
}

type PlanFormProps = { model: PlanFormModel; onCancel: () => void };

export const PlanForm = reatomComponent(({ model, onCancel }: PlanFormProps) => {
  const { fields } = model.form;

  return (
    <form className="flex flex-col gap-4 px-4 pb-6" onSubmit={submitWith(model.save)}>
      <TextField
        field={fields.title}
        id="plan-title"
        label="Название"
        placeholder="Ремонт в спальне"
      />
      <TextAreaField field={fields.note} id="plan-note" label="Заметка" />
      <TextField field={fields.dueDate} id="plan-due-date" label="Срок" type="date" />
      {model.canChooseVisibility() && (
        <ChoiceField
          field={fields.visibility}
          label="Кто видит"
          choices={visibilityChoices}
          onChoose={model.chooseVisibility}
        />
      )}
      <ChoiceField field={fields.assigneeId} label="Исполнитель" choices={model.assignees()} />
      {model.pets().length > 1 && (
        <ChoiceField field={fields.petId} label="Питомец" choices={model.pets()} />
      )}
      <FieldError>{model.failure()}</FieldError>
      <FormButtons isSaving={model.isSaving()} onCancel={onCancel} />
    </form>
  );
}, "PlanForm");

type SubplanFormProps = { model: SubplanFormModel; onCancel: () => void };

export const SubplanForm = reatomComponent(({ model, onCancel }: SubplanFormProps) => {
  const { fields } = model.form;
  const warning = model.warning();

  return (
    <form className="flex flex-col gap-4 px-4 pb-6" onSubmit={submitWith(model.save)}>
      <TextField field={fields.title} id="subplan-title" label="Шаг" placeholder="Купить обои" />
      <TextField field={fields.dueDate} id="subplan-due-date" label="Срок" type="date" />
      {warning !== undefined && <p className="text-sm text-orange-500">{warning}</p>}
      <ChoiceField field={fields.assigneeId} label="Исполнитель" choices={model.assignees()} />
      <FormButtons isSaving={model.isSaving()} onCancel={onCancel} />
    </form>
  );
}, "SubplanForm");
