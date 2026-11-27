import type { ReactNode } from "react";

import { SheetContent } from "./sheet-content.view.tsx";
import { SheetTitle } from "./sheet-title.view.tsx";
import { Sheet } from "./sheet.view.tsx";

type FormDrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function FormDrawer({ open, title, onClose, children }: FormDrawerProps) {
  return (
    <Sheet open={open} onClose={onClose}>
      <SheetContent>
        <SheetTitle>{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
