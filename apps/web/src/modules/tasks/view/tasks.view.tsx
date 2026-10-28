import { reatomComponent } from "@reatom/react";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

import {
  Button,
  Chip,
  FailureBar,
  FormDrawer,
  LoadState,
  Revealed,
  SkeletonSection,
} from "@/common/ui";

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
    <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
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
            Добавить дело
          </span>
        </Button>
      </div>
      {content}
      <UndoBar model={model} />
      <FailureBar failure={model.failure()} onDismiss={model.dismissFailure} />
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
        <FailureBar failure={model.failure()} onDismiss={model.dismissFailure} />
      </>
    );
  }

  if (screen.kind === "loading") {
    return browsing(model, <SkeletonSection rows={5} />);
  }

  return <LoadState failure="Не получилось загрузить дела." onRetry={model.reload} />;
}

const TaskForms = reatomComponent(({ model }: TasksProps) => {
  const openForm = model.openForm();
  const titles = model.formTitles();

  return (
    <>
      <FormDrawer open={openForm === "task"} title={titles.task} onClose={model.back}>
        <TaskForm model={model.taskForm} onCancel={model.back} />
      </FormDrawer>
      <FormDrawer open={openForm === "subtask"} title={titles.subtask} onClose={model.back}>
        <SubtaskForm model={model.subtaskForm} onCancel={model.back} />
      </FormDrawer>
    </>
  );
}, "TaskForms");

export const Tasks = reatomComponent(({ model }: TasksProps) => {
  const screen = model.screen();

  return (
    <>
      <Revealed isSkeleton={screen.kind === "loading"}>{contentOf(model, screen)}</Revealed>
      <TaskForms model={model} />
    </>
  );
}, "Tasks");
