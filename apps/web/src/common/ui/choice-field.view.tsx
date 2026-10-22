import type { FieldAtom } from "@reatom/core";
import { reatomComponent } from "@reatom/react";

import { ChipGroup } from "./chip-group.view.tsx";
import { Chip } from "./chip.view.tsx";

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
      <ChipGroup label={label} role="radiogroup">
        {choices.map(({ value, title }) => (
          <Chip
            key={value}
            role="radio"
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
      </ChipGroup>
    );
  },
  "ChoiceField",
);
