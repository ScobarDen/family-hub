import { reatomComponent } from "@reatom/react";
import type { FormEvent } from "react";

import { goalColor, goalIcon } from "@family-hub/contract";

import {
  Button,
  Chip,
  ChoiceField,
  FieldError,
  IconBadge,
  Label,
  TextAreaField,
  TextField,
  type Choice,
} from "@/common/ui";

import { goalIcons } from "../goals.config.ts";
import type { GoalFormModel } from "../vm/goal-form.vm.ts";
import type { MovementFormModel } from "../vm/movement-form.vm.ts";

const visibilityChoices: Choice[] = [
  { value: "shared", title: "Для всей семьи" },
  { value: "private", title: "Только я" },
];

const kindChoices: Choice[] = [
  { value: "contribution", title: "Пополнение" },
  { value: "withdrawal", title: "Снятие" },
];

function submitWith(save: () => void) {
  return (event: FormEvent) => {
    event.preventDefault();
    save();
  };
}

function FormButtons({ isSaving, onCancel }: { isSaving: boolean; onCancel: () => void }) {
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

const CoverPicker = reatomComponent(({ model }: { model: GoalFormModel }) => {
  const { icon, color } = model.form.fields;
  const chosenColor = goalColor.catch("teal").parse(color());

  return (
    <div className="flex flex-col gap-2">
      <Label>Обложка</Label>
      <div className="flex flex-wrap gap-2">
        {goalIcon.options.map((name) => (
          <Chip
            key={name}
            className="px-2"
            aria-label={name}
            isSelected={icon() === name}
            onClick={() => {
              icon.set(name);
            }}
          >
            <IconBadge icon={goalIcons[name]} tone={chosenColor} />
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {goalColor.options.map((name) => (
          <Chip
            key={name}
            className="px-2"
            aria-label={name}
            isSelected={color() === name}
            onClick={() => {
              color.set(name);
            }}
          >
            <IconBadge icon={goalIcons[goalIcon.catch("piggy-bank").parse(icon())]} tone={name} />
          </Chip>
        ))}
      </div>
    </div>
  );
}, "CoverPicker");

export const GoalForm = reatomComponent(
  ({ model, onCancel }: { model: GoalFormModel; onCancel: () => void }) => {
    const { fields } = model.form;

    return (
      <form className="flex flex-col gap-4 px-4 pb-6" onSubmit={submitWith(model.save)}>
        <TextField
          field={fields.title}
          id="goal-title"
          label="Название"
          placeholder="Отпуск в Турции"
        />
        <TextField field={fields.target} id="goal-target" label="Цель, ₽" placeholder="150000" />
        <TextField field={fields.deadline} id="goal-deadline" label="Дедлайн" type="date" />
        <CoverPicker model={model} />
        <TextAreaField field={fields.note} id="goal-note" label="Заметка" />
        {model.canChooseVisibility() && (
          <ChoiceField field={fields.visibility} label="Кто видит" choices={visibilityChoices} />
        )}
        <FieldError>{model.failure()}</FieldError>
        <FormButtons isSaving={model.isSaving()} onCancel={onCancel} />
      </form>
    );
  },
  "GoalForm",
);

export const MovementForm = reatomComponent(
  ({ model, onCancel }: { model: MovementFormModel; onCancel: () => void }) => {
    const { fields } = model.form;

    return (
      <form className="flex flex-col gap-4 px-4 pb-6" onSubmit={submitWith(model.save)}>
        <ChoiceField field={fields.kind} label="Что" choices={kindChoices} />
        <TextField field={fields.amount} id="movement-amount" label="Сумма, ₽" placeholder="5000" />
        <TextField field={fields.date} id="movement-date" label="Дата" type="date" />
        {model.contributors().length > 1 && (
          <ChoiceField field={fields.memberId} label="Чей вклад" choices={model.contributors()} />
        )}
        <TextField field={fields.comment} id="movement-comment" label="Комментарий" />
        <FieldError>{model.failure()}</FieldError>
        <FormButtons isSaving={model.isSaving()} onCancel={onCancel} />
      </form>
    );
  },
  "MovementForm",
);
