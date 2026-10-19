import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "./ui.lib.ts";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-6 rounded-full bg-white shadow-sm transition-transform data-checked:translate-x-5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
