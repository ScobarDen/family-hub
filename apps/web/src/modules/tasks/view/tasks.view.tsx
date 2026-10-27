import { reatomComponent } from "@reatom/react";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Button, Chip, LoadState } from "@/common/ui";

import type { TasksScreen, TasksScreenModel } from "../vm/tasks.vm.ts";
import { TaskCalendar } from "./task-calendar.view.tsx";
import { TaskDetails } from "./task-details.view.tsx";
import { SubtaskForm, TaskForm } from "./task-form.view.tsx";
import { TaskList } from "./task-list.view.tsx";
import { UndoBar } from "./undo-bar.view.tsx";

export type TasksProps = { model: TasksScreenModel };

const views = [
  { value: "list", title: "Список" },
  { value: "calendar", title: "Календарь" },
] as const;

const scopes = [
  { value: "all", title: "Все" },
  { value: "mine", title: "Мои" },
] as const;

const Switches = reatomComponent(
  ({ model }: TasksProps) => (
    <div className="flex items-center gap-2 px-4 pb-4">
      <div role="group" aria-label="Вид" className="flex gap-1">
        {views.map(({ value, title }) => (
          <Chip
            key={value}
            isSelected={model.view() === value}
            onClick={() => {
              model.showView(value);
            }}
          >
            {title}
          </Chip>
        ))}
      </div>
      <div role="group" aria-label="Чьи дела" className="ml-auto flex gap-1">
        {scopes.map(({ value, title }) => (
          <Chip
            key={value}
            isSelected={model.scope() === value}
            onClick={() => {
              model.showScope(value);
            }}
          >
            {title}
          </Chip>
        ))}
      </div>
    </div>
  ),
  "TaskSwitches",
);

function browsing(model: TasksScreenModel, content: ReactNode) {
  return (
    <>
      <Switches model={model} />
      <div className="px-4 pb-4">
        <Button className="w-full" onClick={model.add}>
          <span className="relative">
            <Plus className="absolute top-1/2 right-full mr-1.5 -translate-y-1/2" />
            Дело
          </span>
        </Button>
      </div>
      {content}
      <UndoBar model={model} />
    </>
  );
}

function contentOf(model: TasksScreenModel, screen: TasksScreen): ReactNode {
  if (screen.kind === "list") {
    return browsing(model, <TaskList model={model} screen={screen} />);
  }

  if (screen.kind === "calendar") {
    return browsing(model, <TaskCalendar model={model} />);
  }

  if (screen.kind === "task") {
    return (
      <>
        <TaskDetails task={screen.task} model={model} />
        <UndoBar model={model} />
      </>
    );
  }

  if (screen.kind === "task-form") {
    return <TaskForm model={model.taskForm} onCancel={model.back} />;
  }

  if (screen.kind === "subtask-form") {
    return <SubtaskForm model={model.subtaskForm} onCancel={model.back} />;
  }

  return (
    <LoadState
      failure={screen.kind === "failed" ? "Не получилось загрузить дела." : undefined}
      onRetry={model.reload}
    />
  );
}

export const Tasks = reatomComponent(
  ({ model }: TasksProps) => contentOf(model, model.screen()),
  "Tasks",
);
