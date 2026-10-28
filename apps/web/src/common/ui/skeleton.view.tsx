import type { ComponentProps } from "react";

import { cn } from "./ui.lib.ts";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--muted)_25%,color-mix(in_oklch,var(--muted)_40%,var(--card))_50%,var(--muted)_75%)] bg-size-[200%_100%] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
