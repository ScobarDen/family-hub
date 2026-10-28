import type { ReactNode } from "react";

import { DrawerContent } from "./drawer-content.view.tsx";
import { DrawerTitle } from "./drawer-title.view.tsx";
import { Drawer } from "./drawer.view.tsx";

type FormDrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function FormDrawer({ open, title, onClose, children }: FormDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose}>
      <DrawerContent>
        <DrawerTitle>{title}</DrawerTitle>
        {children}
      </DrawerContent>
    </Drawer>
  );
}
