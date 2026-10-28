import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

type DrawerProps = Omit<DrawerPrimitive.Root.Props, "onOpenChange" | "swipeDirection"> & {
  onClose: () => void;
};

// Swipe, the overlay and Escape all close through `onClose`, so the model decides what closing means.
export function Drawer({ open, onClose, ...props }: DrawerProps) {
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
    />
  );
}
