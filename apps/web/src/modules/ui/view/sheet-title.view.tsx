import type { ReactNode } from "react";

import { DialogTitle } from "./dialog-title.view.tsx";
import { DrawerTitle } from "./drawer-title.view.tsx";
import { useIsWideWindow } from "./wide-window.view.tsx";

export function SheetTitle({ className, children }: { className?: string; children: ReactNode }) {
  return useIsWideWindow() ? (
    <DialogTitle className={className}>{children}</DialogTitle>
  ) : (
    <DrawerTitle className={className}>{children}</DrawerTitle>
  );
}
