import type * as React from "react";

import { cn } from "./ui.lib.ts";

function FieldError({ className, children, ...props }: React.ComponentProps<"div">) {
  if (children === undefined || children === null || children === "") {
    return null;
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-sm font-normal text-destructive-text", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { FieldError };
