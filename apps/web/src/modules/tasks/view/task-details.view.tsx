import { reatomComponent } from "@reatom/react";
import {
  BellRing,
  CalendarX,
  Circle,
  CircleCheck,
  Lock,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";

import { Button, CheckButton, FieldError, Section, SectionItem } from "@/common/ui";

import type { SubtaskRow, TaskDetails as Details } from "../task-details.lib.ts";
import type { TasksScreenModel } from "../vm/tasks.vm.ts";
import { TaskAlbum } from "./task-album.view.tsx";

type DetailsProps = { task: Details; model: TasksScreenModel };

function completionItemOf(completed: string | undefined) {
  return completed === undefined
    ? { icon: Circle, title: "Отметить выполненным" }
    : { icon: CircleCheck, title: "Вернуть в работу" };
}

const TaskHeader = reatomComponent(
  ({ task, model }: DetailsProps) => (
    <Section footer={<FieldError>{model.failure()}</FieldError>}>
      <SectionItem
        icon={task.isPrivate ? Lock : undefined}
        title={task.when ?? "Без срока"}
        subtitle={task.facts}
        after={
          <Button size="icon-sm" variant="ghost" aria-label="Изменить" onClick={model.edit}>
            <Pencil />
          </Button>
        }
      />
      {task.repeats !== undefined && <SectionItem icon={Repeat} title={task.repeats} />}
      {task.reminders !== undefined && <SectionItem icon={BellRing} title={task.reminders} />}
      {task.note !== undefined && <SectionItem title={task.note} />}
      <SectionItem
        {...completionItemOf(task.completed)}
        subtitle={task.completed}
        disabled={model.isChanging()}
        onClick={model.toggleOpened}
      />
      {task.isRecurring && (
        <SectionItem
          icon={CalendarX}
          title="Пропустить этот раз"
          disabled={model.isChanging()}
          onClick={model.skipOccurrence}
        />
      )}
    </Section>
  ),
  "TaskHeader",
);

type SubtaskProps = { subtask: SubtaskRow; model: TasksScreenModel };

const SubtaskItem = reatomComponent(({ subtask, model }: SubtaskProps) => {
  const buttons = [
    { label: "Изменить шаг", icon: <Pencil />, onClick: model.editSubtask },
    { label: "Удалить шаг", icon: <Trash2 />, onClick: model.removeSubtask },
  ];

  return (
    <SectionItem
      control={
        <CheckButton
          label={`${subtask.status === "completed" ? "Вернуть в работу" : "Отметить выполненным"}: ${subtask.title}`}
          isChecked={subtask.status === "completed"}
          isAlert={subtask.status === "overdue"}
          disabled={model.isChanging()}
          onClick={() => {
            model.toggleSubtask(subtask.id);
          }}
        />
      }
      title={subtask.title}
      subtitle={subtask.subtitle}
      after={buttons.map(({ label, icon, onClick }) => (
        <Button
          key={label}
          size="icon-sm"
          variant="ghost"
          aria-label={label}
          disabled={model.isChanging()}
          onClick={() => {
            onClick(subtask.id);
          }}
        >
          {icon}
        </Button>
      ))}
    />
  );
}, "SubtaskItem");

export function TaskDetails({ task, model }: DetailsProps) {
  return (
    <>
      <TaskHeader task={task} model={model} />
      {task.canAddSubtask && (
        <Section title={task.stepsTitle}>
          {task.subtasks.map((subtask) => (
            <SubtaskItem key={subtask.id} subtask={subtask} model={model} />
          ))}
          <SectionItem icon={Plus} title="Добавить шаг" onClick={model.addSubtask} />
        </Section>
      )}
      {task.album !== null && <TaskAlbum album={task.album} onOpen={model.openAlbum} />}
      {task.canDelete && (
        <Section>
          <SectionItem
            icon={Trash2}
            isDestructive
            title="Удалить дело"
            onClick={model.removeTask}
          />
        </Section>
      )}
    </>
  );
}
