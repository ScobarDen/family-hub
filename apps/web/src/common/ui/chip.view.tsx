import type { ComponentProps } from "react";

import { cn } from "./ui.lib.ts";

type ChipProps = ComponentProps<"button"> & { isSelected?: boolean };

export function Chip({ isSelected = false, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}
