import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "../ui.lib.ts";

export function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn("px-5 pt-2 pb-4 text-center text-headline", className)}
      {...props}
    />
  );
}
