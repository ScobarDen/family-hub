import { CheckButton, SectionItem } from "@/common/ui";

import type { TaskRow as Row } from "../task-rows.lib.ts";
import { TaskMarks } from "./task-marks.view.tsx";

export type TaskRowProps = {
  row: Row;
  disabled: boolean;
  onToggle: (row: Row) => void;
  onOpen: (row: Row) => void;
};

// Overdue reads in words as well as in red, so it does not rest on colour alone.
// The Pet is named too, as two Pets' vaccinations would otherwise read the same.
function subtitleOf({ when, status, petName }: Row): string | undefined {
  const parts = [status === "overdue" ? "просрочено" : undefined, when, petName].filter(
    (part) => part !== undefined,
  );

  return parts.length === 0 ? undefined : parts.join(" · ");
}

export function TaskRow({ row, disabled, onToggle, onOpen }: TaskRowProps) {
  return (
    <SectionItem
      control={
        <CheckButton
          label={`${row.status === "completed" ? "Вернуть в работу" : "Отметить выполненным"}: ${row.title}`}
          isChecked={row.status === "completed"}
          isAlert={row.status === "overdue"}
          disabled={disabled}
          onClick={() => {
            onToggle(row);
          }}
        />
      }
      title={row.title}
      subtitle={subtitleOf(row)}
      after={<TaskMarks row={row} />}
      onClick={() => {
        onOpen(row);
      }}
    />
  );
}
