import type { ComponentProps } from "react";

import { cn } from "../ui.lib.ts";
import { Button } from "./button.view.tsx";

export const primaryActionClass = "h-11 w-full";

export function PrimaryButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button className={cn(primaryActionClass, className)} {...props} />;
}
