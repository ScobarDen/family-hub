import type { FieldAtom } from "@reatom/core";
import { reatomComponent } from "@reatom/react";

import { ChipGroup } from "./chip-group.view.tsx";
import { Chip } from "./chip.view.tsx";
import { PersonAvatar, type AvatarMember } from "./person-avatar.view.tsx";

export type Choice = { value: string; title: string; member?: AvatarMember };

type ChoiceFieldProps = {
  field: FieldAtom<string, string>;
  label: string;
  hint?: string;
  choices: Choice[];
  onChoose?: (value: string) => void;
};

export const ChoiceField = reatomComponent(
  ({ field, label, hint, choices, onChoose }: ChoiceFieldProps) => {
    const selected = field();

    return (
      <ChipGroup label={label} hint={hint} role="radiogroup">
        {choices.map(({ value, title, member }) => (
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
            {member !== undefined && <PersonAvatar member={member} className="-ml-2.5 size-6" />}
            {title}
          </Chip>
        ))}
      </ChipGroup>
    );
  },
  "ChoiceField",
);
