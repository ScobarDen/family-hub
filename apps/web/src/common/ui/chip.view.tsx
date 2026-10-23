import type { ComponentProps } from "react";

import { cn } from "./ui.lib.ts";

type ChipProps = ComponentProps<"button"> & { isSelected?: boolean };

// A file pick shaped as a chip takes the same classes as the chip itself.
export function chipClass(isSelected: boolean): string {
  return cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
    isSelected
      ? "bg-foreground text-background"
      : "bg-[color-mix(in_oklch,var(--foreground)_7%,transparent)] text-foreground",
  );
}

export function Chip({ isSelected = false, className, ...props }: ChipProps) {
  const isRadio = props.role === "radio";

  return (
    <button
      type="button"
      aria-pressed={isRadio ? undefined : isSelected}
      aria-checked={isRadio ? isSelected : undefined}
      className={cn(chipClass(isSelected), className)}
      {...props}
    />
  );
}
