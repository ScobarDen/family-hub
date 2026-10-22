import { cn } from "@/common/ui";

import type { AgendaMark as Mark } from "../calendar.lib.ts";

export function AgendaMark({ mark, isOverdue }: { mark: Mark; isOverdue: boolean }) {
  if (mark.kind === "time") {
    return (
      <span className="w-10 shrink-0 text-center text-[0.8125rem] font-medium">{mark.text}</span>
    );
  }

  if (mark.kind === "same-day") {
    return <span className="w-10 shrink-0" />;
  }

  return (
    <span
      className={cn(
        "flex w-10 shrink-0 flex-col items-center leading-none",
        isOverdue && "text-destructive",
      )}
    >
      <span className="text-lg font-semibold">{mark.day}</span>
      <span className="pt-1 text-[0.6875rem] text-muted-foreground">{mark.month}</span>
    </span>
  );
}
