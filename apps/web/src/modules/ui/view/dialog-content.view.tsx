import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "../ui.lib.ts";

const overlayClass =
  "fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0";

const popupClass =
  "pointer-events-auto flex max-h-[calc(100dvh-4rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-background pt-4 text-foreground shadow-xl outline-none transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-95 motion-safe:data-starting-style:scale-95";

export function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className={overlayClass} />
      <DialogPrimitive.Viewport className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-8">
        <DialogPrimitive.Popup className={cn(popupClass, className)} {...props}>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            {children}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  );
}
