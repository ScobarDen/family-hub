import type { ReactNode } from "react";

import { DialogContent } from "./dialog-content.view.tsx";
import { DrawerContent } from "./drawer-content.view.tsx";
import { useIsWideWindow } from "./wide-window.view.tsx";

export function SheetContent({ children }: { children: ReactNode }) {
  return useIsWideWindow() ? (
    <DialogContent>{children}</DialogContent>
  ) : (
    <DrawerContent>{children}</DrawerContent>
  );
}
