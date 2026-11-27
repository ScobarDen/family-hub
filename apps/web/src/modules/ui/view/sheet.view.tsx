import type { ReactNode } from "react";

import { Dialog } from "./dialog.view.tsx";
import { Drawer } from "./drawer.view.tsx";
import { useIsWideWindow } from "./wide-window.view.tsx";

type SheetProps = { open: boolean; onClose: () => void; children: ReactNode };

export function Sheet(props: SheetProps) {
  return useIsWideWindow() ? <Dialog {...props} /> : <Drawer {...props} />;
}
