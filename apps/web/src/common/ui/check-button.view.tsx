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

// The one control that closes a Plan or a Subplan anywhere in the app: a circle at the row's start.
// It takes an icon's place in the row and still gives the thumb a 44px target.
export function CheckButton({
  label,
  isChecked = false,
  isAlert = false,
  disabled = false,
  onClick,
}: CheckButtonProps) {
  const Icon = isChecked ? CircleCheck : Circle;

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={cn(
        "-m-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted disabled:opacity-50",
        isChecked && "text-primary",
        isAlert && "text-destructive",
      )}
      onClick={onClick}
    >
      <Icon className="size-6" strokeWidth={1.75} />
    </button>
  );
}
