import type { ComponentProps } from "react";

import { cn } from "./ui.lib.ts";

// Not `display: contents`: older WebKit (Telegram on iOS) drops such an element from the
// accessibility tree. Mounted empty and out of the flow, so its text is announced when it appears.
export function LiveRegion({ className, ...props }: ComponentProps<"div">) {
  return <div role="status" className={cn("empty:absolute", className)} {...props} />;
}
