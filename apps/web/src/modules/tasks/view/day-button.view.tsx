import { cn } from "@/common/ui";

import type { DayCell } from "../calendar.lib.ts";

type DayButtonProps = { cell: DayCell; isSelected: boolean; onSelect: (date: string) => void };

export function DayButton({ cell, isSelected, onSelect }: DayButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-current={cell.isToday ? "date" : undefined}
      aria-label={cell.label}
      className="group flex h-11 flex-col items-center justify-center"
      onClick={() => {
        onSelect(cell.date);
      }}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-full text-[0.9375rem] transition-colors",
          !cell.isInMonth && "text-muted-foreground",
          cell.isToday && "font-semibold text-primary-text ring-1 ring-primary ring-inset",
          isSelected ? "bg-primary text-primary-foreground ring-0" : "group-active:bg-muted",
        )}
      >
        {cell.day}
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 size-1 rounded-full",
          cell.hasItems ? "bg-muted-foreground" : "bg-transparent",
        )}
      />
    </button>
  );
}
