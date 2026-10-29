import { reatomComponent } from "@reatom/react";

import { cn } from "@/modules/ui";

import type { TasksScreenModel } from "../vm/tasks.vm.ts";
import { DayButton } from "./day-button.view.tsx";
import { MonthHeader } from "./month-header.view.tsx";

const weekdays = [
  { title: "Пн", isWeekend: false },
  { title: "Вт", isWeekend: false },
  { title: "Ср", isWeekend: false },
  { title: "Чт", isWeekend: false },
  { title: "Пт", isWeekend: false },
  { title: "Сб", isWeekend: true },
  { title: "Вс", isWeekend: true },
];

export const MonthGrid = reatomComponent(({ model }: { model: TasksScreenModel }) => {
  const selected = model.selected();

  return (
    <section className="px-4 pb-4">
      <div className="flex flex-col gap-1 rounded-2xl bg-card px-2 pt-1 pb-2">
        <MonthHeader
          title={model.monthTitle()}
          onPrevious={model.previousMonth}
          onNext={model.nextMonth}
        />
        <div className="grid grid-cols-7 text-center">
          {weekdays.map(({ title, isWeekend }) => (
            <span
              key={title}
              aria-hidden
              className={cn(
                "pb-1 text-xs text-muted-foreground",
                isWeekend && "font-semibold text-foreground",
              )}
            >
              {title}
            </span>
          ))}
          {model.grid().map((cell) => (
            <DayButton
              key={cell.date}
              cell={cell}
              isSelected={cell.date === selected}
              onSelect={model.select}
            />
          ))}
        </div>
      </div>
    </section>
  );
}, "MonthGrid");
