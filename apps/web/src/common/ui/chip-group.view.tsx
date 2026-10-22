import { useId, type ReactNode } from "react";

import { Label } from "./label.view.tsx";

type ChipGroupProps = {
  label: string;
  // One chip of a single choice is a radio; several chosen at once are toggle buttons.
  role?: "group" | "radiogroup";
  children: ReactNode;
};

export function ChipGroup({ label, role = "group", children }: ChipGroupProps) {
  const labelId = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label id={labelId}>{label}</Label>
      <div role={role} aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}
