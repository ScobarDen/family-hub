import type { ComponentProps } from "react";

import { cn } from "./ui.lib.ts";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  );
}
