import { Temporal } from "temporal-polyfill";

import { cn } from "@/common/ui";

import type { CalendarItem } from "../calendar.lib.ts";

export function isOverdue(item: CalendarItem): boolean {
  return (item.kind === "plan" || item.kind === "due") && item.isOverdue;
}

type AgendaMarkProps = { item: CalendarItem; isDated: boolean; isSameDay: boolean };

// The day's list leads with the time, the month's with the date, shown once for a run of one day.
export function AgendaMark({ item, isDated, isSameDay }: AgendaMarkProps) {
  if (!isDated) {
    return (
      <span className="w-10 shrink-0 text-center text-[0.8125rem] font-medium">
        {item.time ?? "весь день"}
      </span>
    );
  }

  if (isSameDay) {
    return <span className="w-10 shrink-0" />;
  }

  const date = Temporal.PlainDate.from(item.date);

  return (
    <span
      className={cn(
        "flex w-10 shrink-0 flex-col items-center leading-none",
        isOverdue(item) && "text-destructive",
      )}
    >
      <span className="text-lg font-semibold">{date.day}</span>
      <span className="pt-1 text-[0.6875rem] text-muted-foreground">
        {date.toLocaleString("ru-RU", { month: "short" }).replace(".", "")}
      </span>
    </span>
  );
}
