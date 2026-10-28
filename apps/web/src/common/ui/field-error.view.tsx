import type * as React from "react";

import { cn } from "./ui.lib.ts";

function FieldError({ className, children, ...props }: React.ComponentProps<"div">) {
  const isEmpty = children === undefined || children === null || children === "";

  return (
    <div role="status" className="contents">
      {!isEmpty && (
        <div
          data-slot="field-error"
          className={cn("text-sm font-normal text-destructive-text", className)}
          {...props}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export { FieldError };
