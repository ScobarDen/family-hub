import type { LucideIcon } from "lucide-react";

import type { IconTone } from "./icon-badge.view.tsx";
import { cn } from "./ui.lib.ts";

// Colour goes on what needs a decision: only an overdue or failing row tints its icon.
export function PlainIcon({ icon: Icon, tone }: { icon: LucideIcon; tone: IconTone }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center",
        tone === "red" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} />
    </span>
  );
}
