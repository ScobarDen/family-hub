import { Circle, CircleCheck } from "lucide-react";

import { cn } from "./ui.lib.ts";

type CheckButtonProps = {
  // What a tap does, with the record it does it to: «Отметить выполненным: Купить корм».
  label: string;
  isChecked?: boolean;
  isAlert?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function iconClass(isShown: boolean): string {
  return cn(
    "col-start-1 row-start-1 size-6 transition-[opacity,scale,filter] duration-300 ease-swap",
    !isShown && "opacity-0 motion-safe:scale-25 motion-safe:blur-xs",
  );
}

// The one control that completes a Task Occurrence or a Subtask anywhere in the app: a circle at the row's start.
// It takes an icon's place in the row and still gives the thumb a 44px target.
export function CheckButton({
  label,
  isChecked = false,
  isAlert = false,
  disabled = false,
  onClick,
}: CheckButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={cn(
        "press -m-2 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground active:bg-muted disabled:opacity-50",
        isChecked && "text-primary",
        isAlert && "text-destructive",
      )}
      onClick={onClick}
    >
      <Circle className={iconClass(!isChecked)} strokeWidth={1.75} />
      <CircleCheck className={iconClass(isChecked)} strokeWidth={1.75} />
    </button>
  );
}
