import { reatomComponent } from "@reatom/react";
import type { FormEvent } from "react";

import { Button, Chip, ChoiceField, FieldError, Label, TextField, type Choice } from "@/common/ui";

import type { ReminderFormModel } from "../vm/reminder-form.vm.ts";

const frequencies: Choice[] = [
  { value: "", title: "Один раз" },
  { value: "weekly", title: "Каждую неделю" },
  { value: "monthly", title: "Каждый месяц" },
  { value: "yearly", title: "Каждый год" },
];
const visibilities: Choice[] = [
  { value: "shared", title: "Для всей семьи" },
  { value: "private", title: "Только мне" },
];

type ReminderFormProps = { model: ReminderFormModel; onCancel: () => void };

const Recipients = reatomComponent(
  ({ model }: { model: ReminderFormModel }) => (
    <div className="flex flex-col gap-2">
      <Label>Кому</Label>
      <div className="flex flex-wrap gap-2">
        <Chip isSelected={model.isForEveryone()} onClick={model.chooseEveryone}>
          Всем
        </Chip>
        {model.recipients().map((recipient) => (
          <Chip
            key={recipient.id}
            isSelected={recipient.isChosen}
            onClick={() => {
              model.toggleRecipient(recipient.id);
            }}
          >
            {recipient.name}
          </Chip>
        ))}
      </div>
    </div>
  ),
  "Recipients",
);

export const ReminderForm = reatomComponent(({ model, onCancel }: ReminderFormProps) => {
  const { fields } = model.form;

  function submit(event: FormEvent) {
    event.preventDefault();
    model.save();
  }

  return (
    <form className="flex flex-col gap-4 px-4 pb-6" onSubmit={submit}>
      <TextField
        field={fields.text}
        id="reminder-text"
        label="Напомнить"
        placeholder="Оплатить интернет"
      />
      <TextField field={fields.date} id="reminder-date" label="Дата" type="date" />
      <TextField field={fields.time} id="reminder-time" label="Время" type="time" />
      <ChoiceField field={fields.frequency} label="Повтор" choices={frequencies} />
      {model.isRecurring() && (
        <TextField field={fields.until} id="reminder-until" label="Повторять до" type="date" />
      )}
      {model.canChooseVisibility() && (
        <ChoiceField field={fields.visibility} label="Кто видит" choices={visibilities} />
      )}
      {!model.isPrivate() && <Recipients model={model} />}
      <FieldError>{model.failure()}</FieldError>
      <Button type="submit" size="lg" disabled={model.isSaving()}>
        {model.isSaving() ? "Сохраняем…" : "Сохранить"}
      </Button>
      {model.canDelete() && (
        <Button type="button" size="lg" variant="destructive" onClick={model.removeReminder}>
          Удалить напоминание
        </Button>
      )}
      <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
        Отмена
      </Button>
    </form>
  );
}, "ReminderForm");
