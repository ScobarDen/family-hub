import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

import { cn } from "../ui.lib.ts";

export function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      className={cn("px-5 pt-2 pb-4 text-center text-headline", className)}
      {...props}
    />
  );
}
