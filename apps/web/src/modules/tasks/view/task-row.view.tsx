import { CheckButton, SectionItem } from "@/common/ui";

import type { TaskRow as Row } from "../task-rows.lib.ts";
import { TaskMarks } from "./task-marks.view.tsx";

export type TaskRowProps = {
  row: Row;
  onToggle: (row: Row) => void;
  onOpen: (row: Row) => void;
};

export function TaskRow({ row, onToggle, onOpen }: TaskRowProps) {
  return (
    <SectionItem
      control={
        <CheckButton
          label={`${row.status === "completed" ? "Вернуть в работу" : "Отметить выполненным"}: ${row.title}`}
          isChecked={row.status === "completed"}
          isAlert={row.status === "overdue"}
          onClick={() => {
            onToggle(row);
          }}
        />
      }
      title={row.title}
      subtitle={row.subtitle}
      after={<TaskMarks row={row} />}
      onClick={() => {
        onOpen(row);
      }}
    />
  );
}
