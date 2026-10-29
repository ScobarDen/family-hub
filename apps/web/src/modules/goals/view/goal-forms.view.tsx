import { reatomComponent } from "@reatom/react";

import { goalColor, goalIcon } from "@family-hub/contract";

import {
  Chip,
  ChipGroup,
  type Choice,
  ChoiceField,
  FormShell,
  IconBadge,
  PickerField,
  TextAreaField,
  TextField,
  visibilityChoices,
} from "@/modules/ui";

import { goalColorTitles, goalIconTitles, goalIcons } from "../goals.config.ts";
import type { GoalFormModel } from "../vm/goal-form.vm.ts";
import type { MovementFormModel } from "../vm/movement-form.vm.ts";

const kindChoices: Choice[] = [
  { value: "contribution", title: "Пополнение" },
  { value: "withdrawal", title: "Снятие" },
];

const CoverPicker = reatomComponent(({ model }: { model: GoalFormModel }) => {
  const { icon, color } = model.form.fields;
  const cover = model.cover();

  return (
    <>
      <ChipGroup label="Значок" role="radiogroup">
        {goalIcon.options.map((name) => (
          <Chip
            key={name}
            role="radio"
            className="px-2"
            aria-label={goalIconTitles[name]}
            isSelected={icon() === name}
            onClick={() => {
              icon.set(name);
            }}
          >
            <IconBadge icon={goalIcons[name]} tone={cover.color} />
          </Chip>
        ))}
      </ChipGroup>
      <ChipGroup label="Цвет" role="radiogroup">
        {goalColor.options.map((name) => (
          <Chip
            key={name}
            role="radio"
            className="px-2"
            aria-label={goalColorTitles[name]}
            isSelected={color() === name}
            onClick={() => {
              color.set(name);
            }}
          >
            <IconBadge icon={goalIcons[cover.icon]} tone={name} />
          </Chip>
        ))}
      </ChipGroup>
    </>
  );
}, "CoverPicker");

export const GoalForm = reatomComponent(
  ({ model, onCancel }: { model: GoalFormModel; onCancel: () => void }) => {
    const { fields } = model.form;

    return (
      <FormShell model={model} onCancel={onCancel}>
        <TextField
          field={fields.title}
          id="goal-title"
          label="Название"
          placeholder="Отпуск в Турции"
        />
        <TextField
          field={fields.target}
          id="goal-target"
          label="Цель, ₽"
          placeholder="150000"
          inputMode="numeric"
        />
        <PickerField field={fields.deadline} id="goal-deadline" label="Дедлайн" isOptional />
        <CoverPicker model={model} />
        <TextAreaField field={fields.note} id="goal-note" label="Заметка" />
        {model.canChooseVisibility() && (
          <ChoiceField field={fields.visibility} label="Кто видит" choices={visibilityChoices} />
        )}
      </FormShell>
    );
  },
  "GoalForm",
);

export const MovementForm = reatomComponent(
  ({ model, onCancel }: { model: MovementFormModel; onCancel: () => void }) => {
    const { fields } = model.form;

    return (
      <FormShell model={model} onCancel={onCancel}>
        <ChoiceField field={fields.kind} label="Что" choices={kindChoices} />
        <TextField
          field={fields.amount}
          id="movement-amount"
          label="Сумма, ₽"
          placeholder="5000"
          inputMode="numeric"
        />
        <PickerField field={fields.date} id="movement-date" label="Дата" />
        {model.hasContributorChoice() && (
          <ChoiceField field={fields.memberId} label="Чей вклад" choices={model.contributors()} />
        )}
        <TextField field={fields.comment} id="movement-comment" label="Комментарий" />
      </FormShell>
    );
  },
  "MovementForm",
);
