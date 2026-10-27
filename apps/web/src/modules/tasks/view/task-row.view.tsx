import { CheckButton, SectionItem } from "@/common/ui";

import type { TaskRow as Row } from "../tasks.lib.ts";
import { TaskMarks } from "./task-marks.view.tsx";

type TaskRowProps = {
  row: Row;
  disabled: boolean;
  onToggle: (row: Row) => void;
  onOpen: (row: Row) => void;
};

// Overdue reads in words as well as in red, so it does not rest on colour alone.
function subtitleOf({ when, isOverdue }: Row): string | undefined {
  if (!isOverdue) {
    return when;
  }

  return when === undefined ? "просрочено" : `просрочено · ${when}`;
}

export function TaskRow({ row, disabled, onToggle, onOpen }: TaskRowProps) {
  return (
    <SectionItem
      control={
        <CheckButton
          label={`${row.isCompleted ? "Вернуть в работу" : "Отметить выполненным"}: ${row.title}`}
          isChecked={row.isCompleted}
          isAlert={row.isOverdue}
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
