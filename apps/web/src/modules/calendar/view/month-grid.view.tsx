import { reatomComponent } from "@reatom/react";

import { cn } from "@/common/ui";

import type { CalendarModel } from "../vm/calendar.vm.ts";
import { MonthHeader } from "./month-header.view.tsx";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const MonthGrid = reatomComponent(({ model }: { model: CalendarModel }) => {
  const selected = model.selected();

  return (
    <section className="flex flex-col gap-2 px-4 pb-6">
      <MonthHeader
        title={model.monthTitle()}
        onPrevious={model.previousMonth}
        onNext={model.nextMonth}
      />
      <div className="grid grid-cols-7 gap-1 rounded-xl bg-card p-2 text-center text-sm">
        {weekdays.map((weekday) => (
          <span key={weekday} className="py-1 text-xs text-muted-foreground">
            {weekday}
          </span>
        ))}
        {model.grid().map((cell) => (
          <button
            key={cell.date}
            type="button"
            aria-pressed={cell.date === selected}
            className={cn(
              "relative flex aspect-square flex-col items-center justify-center rounded-full",
              !cell.isInMonth && "text-muted-foreground/50",
              cell.isToday && "font-bold text-primary",
              cell.date === selected && "bg-primary text-primary-foreground",
            )}
            onClick={() => {
              model.select(cell.date);
            }}
          >
            {cell.day}
            {cell.hasItems && <span className="absolute bottom-1 size-1 rounded-full bg-current" />}
          </button>
        ))}
      </div>
    </section>
  );
}, "MonthGrid");
