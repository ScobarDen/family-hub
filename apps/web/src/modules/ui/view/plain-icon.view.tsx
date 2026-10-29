import type { LucideIcon } from "lucide-react";

import { cn } from "../ui.lib.ts";

// Colour goes on what needs a decision: only an overdue or failing row tints its icon.
export function PlainIcon({ icon: Icon, isAlert }: { icon: LucideIcon; isAlert: boolean }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center",
        isAlert ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} />
    </span>
  );
}
