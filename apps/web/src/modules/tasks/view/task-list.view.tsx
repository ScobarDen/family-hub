import { reatomComponent } from "@reatom/react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { FieldError, Section, SectionItem } from "@/common/ui";

import type { TaskGroups } from "../tasks.lib.ts";
import type { TasksScreen, TasksScreenModel } from "../vm/tasks.vm.ts";
import { TaskRow } from "./task-row.view.tsx";

type ListProps = { model: TasksScreenModel; screen: Extract<TasksScreen, { kind: "list" }> };

const groupTitles: Array<[keyof Omit<TaskGroups, "completed">, string]> = [
  ["overdue", "Просрочено"],
  ["today", "Сегодня"],
  ["upcoming", "Скоро"],
  ["undated", "Без срока"],
];

export const TaskList = reatomComponent(({ model, screen }: ListProps) => {
  const { groups } = screen;
  const isEmpty = groupTitles.every(([group]) => groups[group].length === 0);
  const rowProps = { disabled: model.isChanging(), onToggle: model.toggle, onOpen: model.openRow };

  return (
    <>
      <FieldError>{model.failure()}</FieldError>
      {isEmpty && (
        <Section>
          <SectionItem title="Дел нет" subtitle="Нажмите «+», чтобы добавить первое" />
        </Section>
      )}
      {groupTitles.map(([group, title]) =>
        groups[group].length === 0 ? null : (
          <Section key={group} title={title}>
            {groups[group].map((row) => (
              <TaskRow key={row.key} row={row} {...rowProps} />
            ))}
          </Section>
        ),
      )}
      {groups.completed.length > 0 && (
        <Section>
          <SectionItem
            icon={screen.isCompletedShown ? ChevronUp : ChevronDown}
            title={`Выполненные · ${groups.completed.length}`}
            onClick={model.toggleCompleted}
          />
          {screen.isCompletedShown &&
            groups.completed.map((row) => <TaskRow key={row.key} row={row} {...rowProps} />)}
        </Section>
      )}
    </>
  );
}, "TaskList");
