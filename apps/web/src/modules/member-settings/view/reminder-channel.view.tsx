import { reatomComponent } from "@reatom/react";

import { Chip, ChipGroup, FieldError } from "@/modules/ui";

import type { ReminderChannelModel } from "../vm/reminder-channel.vm.ts";

export type ReminderChannelProps = { model: ReminderChannelModel };

export const ReminderChannelSetting = reatomComponent(({ model }: ReminderChannelProps) => {
  const channel = model.channel();

  return (
    <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
      <ChipGroup
        label="Куда слать напоминания"
        hint="Push приходит на устройства, где включён в установленном приложении"
        role="radiogroup"
      >
        {model.choices.map(({ value, label }) => (
          <Chip
            key={value}
            role="radio"
            isSelected={value === channel}
            onClick={() => {
              model.choose(value);
            }}
          >
            {label}
          </Chip>
        ))}
      </ChipGroup>
      <FieldError>{model.failure()}</FieldError>
    </div>
  );
}, "ReminderChannelSetting");
