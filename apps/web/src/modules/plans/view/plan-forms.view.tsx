import { reatomComponent } from "@reatom/react";

import { type Choice, ChoiceField, FormShell, TextAreaField, TextField } from "@/common/ui";

import type { PlanFormModel } from "../vm/plan-form.vm.ts";
import type { SubplanFormModel } from "../vm/subplan-form.vm.ts";

const visibilityChoices: Choice[] = [
  { value: "shared", title: "Для всей семьи" },
  { value: "private", title: "Только я" },
];

const reminderChoices: Choice[] = [
  { value: "", title: "Не напоминать" },
  { value: "on-day", title: "В день срока" },
  { value: "1d", title: "За день" },
  { value: "1w", title: "За неделю" },
];

type PlanFormProps = { model: PlanFormModel; onCancel: () => void };

export const PlanForm = reatomComponent(({ model, onCancel }: PlanFormProps) => {
  const { fields } = model.form;

  return (
    <FormShell model={model} onCancel={onCancel}>
      <TextField
        field={fields.title}
        id="plan-title"
        label="Название"
        placeholder="Ремонт в спальне"
      />
      <TextAreaField field={fields.note} id="plan-note" label="Заметка" />
      <TextField field={fields.dueDate} id="plan-due-date" label="Срок" type="date" />
      {fields.dueDate() !== "" && (
        <ChoiceField field={fields.reminder} label="Напомнить" choices={reminderChoices} />
      )}
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
      {model.albums().length > 1 && (
        <ChoiceField field={fields.albumId} label="Альбом" choices={model.albums()} />
      )}
    </FormShell>
  );
}, "PlanForm");

type SubplanFormProps = { model: SubplanFormModel; onCancel: () => void };

export const SubplanForm = reatomComponent(({ model, onCancel }: SubplanFormProps) => {
  const { fields } = model.form;
  const warning = model.warning();

  return (
    <FormShell model={model} onCancel={onCancel}>
      <TextField field={fields.title} id="subplan-title" label="Шаг" placeholder="Купить обои" />
      <TextField field={fields.dueDate} id="subplan-due-date" label="Срок" type="date" />
      {warning !== undefined && <p className="text-sm text-orange-500">{warning}</p>}
      {fields.dueDate() !== "" && (
        <ChoiceField field={fields.reminder} label="Напомнить" choices={reminderChoices} />
      )}
      <ChoiceField field={fields.assigneeId} label="Исполнитель" choices={model.assignees()} />
    </FormShell>
  );
}, "SubplanForm");
