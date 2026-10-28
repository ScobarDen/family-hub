import type * as React from "react";

import { LiveRegion } from "./live-region.view.tsx";
import { cn } from "./ui.lib.ts";

function FieldError({ className, children, ...props }: React.ComponentProps<"div">) {
  const isEmpty = children === undefined || children === null || children === "";

  return (
    <LiveRegion>
      {!isEmpty && (
        <div
          data-slot="field-error"
          className={cn("text-sm font-normal text-destructive-text", className)}
          {...props}
        >
          {children}
        </div>
      )}
    </LiveRegion>
  );
}

export { FieldError };
