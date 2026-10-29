import { reatomComponent } from "@reatom/react";

import { Chip, ChipGroup, FieldError, ScreenTitle } from "@/modules/ui";

import type { Slot, TabBarMenuModel } from "../vm/tab-bar-menu.vm.ts";

const slotNames = ["Слева от микрофона", "Справа от микрофона"];

function SlotPicker({ model, slot }: { model: TabBarMenuModel; slot: Slot }) {
  return (
    <div className="px-5 pb-6">
      <ChipGroup label={slotNames[slot.index] ?? ""} role="radiogroup">
        {model.choices.map(({ module, title }) => (
          <Chip
            key={module}
            role="radio"
            isSelected={module === slot.module}
            aria-disabled={model.isSaving() || undefined}
            onClick={() => {
              model.choose(slot.index, module);
            }}
          >
            {title}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  );
}

export const TabBarMenu = reatomComponent(
  ({ model }: { model: TabBarMenuModel }) => (
    <>
      <ScreenTitle title="Панель снизу" subtitle="Два раздела рядом с микрофоном" />
      {model.slots().map((slot) => (
        <SlotPicker key={slot.index} model={model} slot={slot} />
      ))}
      <div className="px-5">
        <FieldError>{model.failure()}</FieldError>
      </div>
    </>
  ),
  "TabBarMenu",
);
