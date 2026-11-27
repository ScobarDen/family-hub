import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ReactNode } from "react";

type DialogProps = Omit<DialogPrimitive.Root.Props, "onOpenChange" | "children"> & {
  onClose: () => void;
  children: ReactNode;
};

// Escape and the overlay close through `onClose`, as a drawer's swipe does, so the model decides what closing means.
export function Dialog({ open, onClose, children, ...props }: DialogProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (open === true && !next) {
          onClose();
        }
      }}
      {...props}
    >
      {children}
    </DialogPrimitive.Root>
  );
}
