import type { ComponentProps } from "react";

import { Button } from "./button.view.tsx";
import { cn } from "./ui.lib.ts";

export const primaryActionClass = "h-11 w-full";

export function PrimaryButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button className={cn(primaryActionClass, className)} {...props} />;
}
