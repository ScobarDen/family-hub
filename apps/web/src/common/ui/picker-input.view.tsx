import { reatomComponent } from "@reatom/react";
import { CalendarDays, Clock, X } from "lucide-react";
import type { ComponentProps, MouseEvent } from "react";

import { deviceTimeZone, formatPickedValue, type PickerType, today } from "@/common/format-date";

import { Button } from "./button.view.tsx";
import { cn } from "./ui.lib.ts";

type PickerInputProps = Pick<
  ComponentProps<"input">,
  "id" | "aria-label" | "aria-invalid" | "max" | "onBlur" | "onFocus" | "className"
> & {
  kind: PickerType;
  value: string;
  onValueChange: (value: string) => void;
  clearLabel?: string;
};

// showPicker throws inside a cross-origin iframe (Telegram Web) and is missing in older WebViews;
// there the indicator, stretched invisibly over the whole input, still opens the picker on a tap.
function openPicker(event: MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker();
  } catch {}
}

export const PickerInput = reatomComponent(
  ({ kind, value, onValueChange, clearLabel, className, ...input }: PickerInputProps) => {
    const Icon = kind === "time" ? Clock : CalendarDays;

    return (
      <div
        className={cn(
          "relative flex h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-base transition-colors has-[input:focus-visible]:border-ring has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-disabled:opacity-50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30",
          className,
        )}
      >
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span aria-hidden className={cn("truncate", value === "" && "text-muted-foreground")}>
          {formatPickedValue(kind, value, today(deviceTimeZone()))}
        </span>
        <input
          type={kind}
          value={value}
          className="absolute inset-0 size-full cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          onClick={openPicker}
          onChange={(event) => {
            onValueChange(event.target.value);
          }}
          {...input}
        />
        {clearLabel !== undefined && value !== "" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative -mr-3 ml-auto shrink-0"
            aria-label={clearLabel}
            onClick={() => {
              onValueChange("");
            }}
          >
            <X />
          </Button>
        )}
      </div>
    );
  },
  "PickerInput",
);
