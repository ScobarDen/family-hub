import { reatomComponent } from "@reatom/react";

import {
  Chip,
  ChipGroup,
  type Choice,
  ChoiceField,
  FormShell,
  TextAreaField,
  TextField,
  visibilityChoices,
} from "@/common/ui";

import { repeatChoices } from "../calendar.config.ts";
import type { EventFormModel } from "../vm/event-form.vm.ts";

const timings: Choice[] = [
  { value: "all-day", title: "Весь день" },
  { value: "timed", title: "Со временем" },
];
const frequencies: Choice[] = [{ value: "", title: "Не повторять" }, ...repeatChoices];

type EventFormProps = { model: EventFormModel; onCancel: () => void };

const ReminderOffsets = reatomComponent(
  ({ model }: { model: EventFormModel }) => (
    <ChipGroup label="Напомнить">
      {model.offsets().map((choice) => (
        <Chip
          key={choice.offset}
          isSelected={choice.isChosen}
          onClick={() => {
            model.toggleOffset(choice.offset);
          }}
        >
          {choice.title}
        </Chip>
      ))}
    </ChipGroup>
  ),
  "ReminderOffsets",
);

const EventWhen = reatomComponent(({ model }: { model: EventFormModel }) => {
  const { fields } = model.form;
  const isTimed = model.isTimed();

  return (
    <>
      <ChoiceField field={fields.timing} label="Когда" choices={timings} />
      <TextField field={fields.date} id="event-date" label="Дата" type="date" />
      {isTimed && <TextField field={fields.time} id="event-time" label="Время" type="time" />}
      <TextField field={fields.endDate} id="event-end-date" label="Окончание" type="date" />
      {isTimed && (
        <TextField field={fields.endTime} id="event-end-time" label="Время окончания" type="time" />
      )}
    </>
  );
}, "EventWhen");

export const EventForm = reatomComponent(({ model, onCancel }: EventFormProps) => {
  const { fields } = model.form;

  return (
    <FormShell model={model} onCancel={onCancel}>
      <TextField
        field={fields.title}
        id="event-title"
        label="Название"
        placeholder="Созвон с родителями"
      />
      <EventWhen model={model} />
      <ChoiceField field={fields.frequency} label="Повтор" choices={frequencies} />
      {model.isRecurring() && (
        <TextField field={fields.until} id="event-until" label="Повторять до" type="date" />
      )}
      <ReminderOffsets model={model} />
      {model.canChooseVisibility() && (
        <ChoiceField field={fields.visibility} label="Кто видит" choices={visibilityChoices} />
      )}
      <TextAreaField field={fields.note} id="event-note" label="Заметка" />
    </FormShell>
  );
}, "EventForm");
