import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

import { cn } from "../ui.lib.ts";

const overlayClass =
  "fixed inset-0 z-50 min-h-dvh bg-black/40 opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] select-none data-ending-style:pointer-events-none data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute";

// Under reduced motion the sheet fades in place instead of sliding; a swipe still follows the finger.
const popupClass =
  "group/drawer-popup pointer-events-auto fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[calc(100dvh-var(--safe-area-top)-1rem)] w-full max-w-lg flex-col rounded-t-2xl bg-background pb-safe-bottom text-foreground outline-none transform-[translate3d(0,var(--drawer-swipe-movement-y,0px),0)] transition-[transform,opacity] duration-450 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform [--closed-transform:translate3d(0,calc(100%+2px),0)] data-swiping:duration-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] motion-safe:data-starting-style:transform-(--closed-transform) motion-safe:data-ending-style:transform-(--closed-transform) motion-reduce:data-starting-style:opacity-0 motion-reduce:data-ending-style:opacity-0 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-12 after:bg-background";

type DrawerContentProps = DrawerPrimitive.Popup.Props & { keepMounted?: boolean };

export function DrawerContent({ className, children, keepMounted, ...props }: DrawerContentProps) {
  return (
    <DrawerPrimitive.Portal keepMounted={keepMounted}>
      <DrawerPrimitive.Backdrop className={overlayClass} />
      <DrawerPrimitive.Viewport className="fixed inset-0 z-50 select-none">
        <DrawerPrimitive.Popup className={cn(popupClass, className)} {...props}>
          <div aria-hidden className="flex h-5 shrink-0 cursor-grab items-end justify-center">
            <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          <DrawerPrimitive.Content className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain select-text">
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  );
}
