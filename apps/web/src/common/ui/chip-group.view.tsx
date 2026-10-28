import { useId, type ReactNode } from "react";

import { Label } from "./label.view.tsx";

type ChipGroupProps = {
  label: string;
  hint?: string;
  // One chip of a single choice is a radio; several chosen at once are toggle buttons.
  role?: "group" | "radiogroup";
  children: ReactNode;
};

export function ChipGroup({ label, hint, role = "group", children }: ChipGroupProps) {
  const labelId = useId();
  const hintId = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label id={labelId}>{label}</Label>
      <div
        role={role}
        aria-labelledby={labelId}
        aria-describedby={hint === undefined ? undefined : hintId}
        className="flex flex-wrap gap-2"
      >
        {children}
      </div>
      {hint !== undefined && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
