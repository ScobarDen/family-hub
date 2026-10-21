import type { FieldAtom } from "@reatom/core";
import { reatomComponent } from "@reatom/react";

import { Chip } from "./chip.view.tsx";
import { Label } from "./label.view.tsx";

export type Choice = { value: string; title: string };

type ChoiceFieldProps = {
  field: FieldAtom<string, string>;
  label: string;
  choices: Choice[];
  onChoose?: (value: string) => void;
};

export const ChoiceField = reatomComponent(
  ({ field, label, choices, onChoose }: ChoiceFieldProps) => {
    const selected = field();

    return (
      <div className="flex flex-col gap-2">
        <Label>{label}</Label>
        <div className="flex flex-wrap gap-2">
          {choices.map(({ value, title }) => (
            <Chip
              key={value}
              isSelected={value === selected}
              onClick={() => {
                if (onChoose === undefined) {
                  field.set(value);
                } else {
                  onChoose(value);
                }
              }}
            >
              {title}
            </Chip>
          ))}
        </div>
      </div>
    );
  },
  "ChoiceField",
);
