import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import type { ReactNode } from "react";

type DrawerProps = Omit<
  DrawerPrimitive.Root.Props,
  "onOpenChange" | "swipeDirection" | "children"
> & {
  onClose: () => void;
  children: ReactNode;
};

// Swipe, the overlay and Escape all close through `onClose`, so the model decides what closing means.
// The keyboard provider pads the scrolling content so iOS keeps the focused field above the keyboard.
export function Drawer({ open, onClose, children, ...props }: DrawerProps) {
  return (
    <DrawerPrimitive.Root
      open={open}
      swipeDirection="down"
      onOpenChange={(next) => {
        if (open === true && !next) {
          onClose();
        }
      }}
      {...props}
    >
      <DrawerPrimitive.VirtualKeyboardProvider>{children}</DrawerPrimitive.VirtualKeyboardProvider>
    </DrawerPrimitive.Root>
  );
}
