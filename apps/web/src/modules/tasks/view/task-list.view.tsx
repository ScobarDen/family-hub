import { reatomComponent } from "@reatom/react";
import { Cake, ChevronDown, ChevronUp } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import type { ListRow, TaskGroups } from "../task-rows.lib.ts";
import type { TasksScreen, TasksScreenModel } from "../vm/tasks.vm.ts";
import { TaskRow, type TaskRowProps } from "./task-row.view.tsx";

type ListProps = { model: TasksScreenModel; screen: Extract<TasksScreen, { kind: "list" }> };

const groupTitles: Array<[keyof Omit<TaskGroups, "completed">, string]> = [
  ["overdue", "Просрочено"],
  ["today", "Сегодня"],
  ["upcoming", "Скоро"],
  ["undated", "Без срока"],
];

type RowProps = Omit<TaskRowProps, "row"> & { onOpenPet: (petId: string) => void };

function ListItem({ row, onOpenPet, ...rowProps }: RowProps & { row: ListRow }) {
  return row.kind === "task" ? (
    <TaskRow row={row} {...rowProps} />
  ) : (
    <SectionItem
      icon={Cake}
      title={row.title}
      subtitle={row.when}
      onClick={() => {
        onOpenPet(row.petId);
      }}
    />
  );
}

export const TaskList = reatomComponent(({ model, screen }: ListProps) => {
  const { groups, empty } = screen;
  const rowProps = {
    onToggle: model.toggle,
    onOpen: model.openRow,
    onOpenPet: model.openPet,
  };

  return (
    <>
      {empty !== undefined && (
        <Section>
          <SectionItem title={empty.title} subtitle={empty.hint} />
        </Section>
      )}
      {groupTitles.map(([group, title]) =>
        groups[group].length === 0 ? null : (
          <Section key={group} title={title}>
            {groups[group].map((row) => (
              <ListItem key={row.key} row={row} {...rowProps} />
            ))}
          </Section>
        ),
      )}
      {groups.completed.length > 0 && (
        <Section>
          <SectionItem
            icon={screen.isCompletedShown ? ChevronUp : ChevronDown}
            title={`Выполненные · ${groups.completed.length}`}
            isExpanded={screen.isCompletedShown}
            onClick={model.toggleCompleted}
          />
          {screen.isCompletedShown &&
            groups.completed.map((row) => <ListItem key={row.key} row={row} {...rowProps} />)}
        </Section>
      )}
    </>
  );
}, "TaskList");
