import type * as React from "react";

import { cn } from "../ui.lib.ts";

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation="vertical"
      className={cn(
        "group/field flex w-full flex-col gap-2 data-[invalid=true]:text-destructive-text *:w-full [&>.sr-only]:w-auto",
        className,
      )}
      {...props}
    />
  );
}

export { Field };
