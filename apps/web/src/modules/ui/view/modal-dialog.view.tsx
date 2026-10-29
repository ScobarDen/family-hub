import { useLayoutEffect, useRef, type ComponentProps } from "react";

import { cn } from "../ui.lib.ts";

type ModalDialogProps = Omit<ComponentProps<"dialog">, "open" | "onClose"> & {
  isOpen: boolean;
  onClose: () => void;
};

// `showModal` makes the page behind inert, focuses the first control, closes on Escape and
// returns focus to the opener on close; Escape reaches the model through `onClose`.
export function ModalDialog({ isOpen, onClose, className, ...props }: ModalDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const element = dialog.current;

    if (element === null || element.open === isOpen) {
      return;
    }

    if (isOpen) {
      element.showModal();
    } else {
      element.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialog}
      className={cn(
        "fixed inset-0 z-50 m-0 size-full max-h-none max-w-none overscroll-contain border-0 bg-transparent p-0 text-inherit backdrop:bg-transparent",
        className,
      )}
      onClose={(event) => {
        // `close` fires a task later: a dialog shown again by then is not the one that closed.
        if (isOpen && !event.currentTarget.open) {
          onClose();
        }
      }}
      {...props}
    />
  );
}
