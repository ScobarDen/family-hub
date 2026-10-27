import { CalendarClock, Plus, TriangleAlert } from "lucide-react";

import { Button, Section, SectionItem } from "@/common/ui";

import type { PetTaskRow } from "../pets.lib.ts";

type PetTasksProps = {
  tasks: PetTaskRow[];
  onOpen: (taskId: string) => void;
  onAdd: (() => void) | undefined;
};

export function PetTasks({ tasks, onOpen, onAdd }: PetTasksProps) {
  return (
    <Section
      title="Дела"
      {...(onAdd === undefined
        ? {}
        : {
            aside: (
              <Button
                size="icon"
                variant="ghost"
                className="size-11"
                aria-label="Добавить дело"
                onClick={onAdd}
              >
                <Plus />
              </Button>
            ),
          })}
    >
      {tasks.length === 0 && <SectionItem icon={CalendarClock} title="Ближайших дел нет" />}
      {tasks.map((task) => (
        <SectionItem
          key={task.key}
          icon={task.status === "overdue" ? TriangleAlert : CalendarClock}
          isAlert={task.status === "overdue"}
          title={task.title}
          subtitle={task.subtitle}
          onClick={() => {
            onOpen(task.taskId);
          }}
        />
      ))}
    </Section>
  );
}
