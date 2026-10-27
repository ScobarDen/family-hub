import { reatomComponent } from "@reatom/react";
import { ChevronDown } from "lucide-react";

import {
  Chip,
  ChipGroup,
  type Choice,
  ChoiceField,
  FormShell,
  PersonAvatar,
  SectionItem,
  TextAreaField,
  TextField,
  visibilityChoices,
} from "@/common/ui";

import { repeatChoices } from "../tasks.config.ts";
import type { SubtaskFormModel } from "../vm/subtask-form.vm.ts";
import type { PersonChoice, TaskFormModel } from "../vm/task-form.vm.ts";

const frequencies: Choice[] = [{ value: "", title: "Не повторять" }, ...repeatChoices];

const recipientModes: Choice[] = [
  { value: "default", title: "Исполнителям или мне" },
  { value: "everyone", title: "Всем" },
  { value: "members", title: "Выбрать" },
];

type PeopleProps = { label: string; people: PersonChoice[]; onToggle: (id: string) => void };

export function PeopleChips({ label, people, onToggle }: PeopleProps) {
  return (
    <ChipGroup label={label}>
      {people.map(({ id, member, isChosen }) => (
        <Chip
          key={id}
          isSelected={isChosen}
          onClick={() => {
            onToggle(id);
          }}
        >
          <PersonAvatar member={member} className="-ml-2 size-6" />
          {member.name}
        </Chip>
      ))}
    </ChipGroup>
  );
}

const TaskWhen = reatomComponent(({ model }: { model: TaskFormModel }) => {
  const { fields } = model.form;

  return (
    <>
      <TextField field={fields.date} id="task-date" label="Дата" type="date" />
      {model.hasDate() && (
        <>
          <TextField field={fields.time} id="task-time" label="Время" type="time" />
          <TextField field={fields.endDate} id="task-end-date" label="Окончание" type="date" />
          {model.isTimed() && (
            <TextField
              field={fields.endTime}
              id="task-end-time"
              label="Время окончания"
              type="time"
            />
          )}
        </>
      )}
    </>
  );
}, "TaskWhen");

// Recurrence and Reminders need a date, so they stay away until one is set.
const TaskSchedule = reatomComponent(({ model }: { model: TaskFormModel }) => {
  const { fields } = model.form;

  if (!model.hasDate()) {
    return null;
  }

  return (
    <>
      {model.canRepeat() && (
        <ChoiceField field={fields.frequency} label="Повтор" choices={frequencies} />
      )}
      {model.isRecurring() && (
        <TextField field={fields.until} id="task-until" label="Повторять до" type="date" />
      )}
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
      {model.offsets().some(({ isChosen }) => isChosen) && (
        <ChoiceField field={fields.recipients} label="Кому напомнить" choices={recipientModes} />
      )}
      {fields.recipients() === "members" && (
        <PeopleChips
          label="Получатели"
          people={model.recipientChoices()}
          onToggle={model.toggleRecipient}
        />
      )}
    </>
  );
}, "TaskSchedule");

const TaskMore = reatomComponent(({ model }: { model: TaskFormModel }) => {
  const { fields } = model.form;

  return (
    <>
      <PeopleChips label="Исполнители" people={model.assignees()} onToggle={model.toggleAssignee} />
      <TaskSchedule model={model} />
      {model.hasPetChoice() && (
        <ChoiceField field={fields.petId} label="Питомец" choices={model.pets()} />
      )}
      {model.hasAlbumChoice() && (
        <ChoiceField field={fields.albumId} label="Альбом" choices={model.albums()} />
      )}
      {model.canChooseVisibility() && (
        <ChoiceField
          field={fields.visibility}
          label="Кто видит"
          choices={visibilityChoices}
          onChoose={model.chooseVisibility}
        />
      )}
      <TextAreaField field={fields.note} id="task-note" label="Заметка" />
    </>
  );
}, "TaskMore");

type TaskFormProps = { model: TaskFormModel; onCancel: () => void };

// «+» asks for a title and a date; everything else is folded until opened.
export const TaskForm = reatomComponent(
  ({ model, onCancel }: TaskFormProps) => (
    <FormShell model={model} onCancel={onCancel}>
      <TextField
        field={model.form.fields.title}
        id="task-title"
        label="Название"
        placeholder="Купить пылесос"
      />
      <TaskWhen model={model} />
      {model.isExpanded() ? (
        <TaskMore model={model} />
      ) : (
        <SectionItem
          icon={ChevronDown}
          title="Ещё"
          subtitle="Исполнители, повтор, напоминания, питомец, альбом"
          onClick={model.expand}
        />
      )}
    </FormShell>
  ),
  "TaskForm",
);

type SubtaskFormProps = { model: SubtaskFormModel; onCancel: () => void };

export const SubtaskForm = reatomComponent(({ model, onCancel }: SubtaskFormProps) => {
  const { fields } = model.form;

  return (
    <FormShell model={model} onCancel={onCancel}>
      <TextField field={fields.title} id="subtask-title" label="Шаг" placeholder="Купить обои" />
      <TextField field={fields.date} id="subtask-date" label="Срок" type="date" />
      <PeopleChips label="Исполнители" people={model.assignees()} onToggle={model.toggleAssignee} />
    </FormShell>
  );
}, "SubtaskForm");
