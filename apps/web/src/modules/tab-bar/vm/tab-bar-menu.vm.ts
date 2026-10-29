import { action, computed, noop } from "@reatom/core";

import { slotModule, type SlotModule } from "@family-hub/contract";

import { sectionTitles } from "@/modules/sections";
import type { Haptics } from "@/modules/telegram";

import type { TabBarModules } from "../tab-bar.model.ts";

export type SlotChoice = { module: SlotModule; title: string };

export type Slot = { index: number; module: SlotModule; title: string };

// A module already in the other slot swaps places with the one being replaced.
function withSlotChosen(current: SlotModule[], index: number, module: SlotModule): SlotModule[] {
  const next = [...current];
  const other = next.indexOf(module);
  const replaced = next[index];

  if (replaced === undefined || replaced === module) {
    return current;
  }

  if (other !== -1) {
    next[other] = replaced;
  }

  next[index] = module;

  return next;
}

export function reatomTabBarMenu({
  modules,
  telegram,
}: {
  modules: TabBarModules;
  telegram: { haptics: Pick<Haptics, "select" | "error"> };
}) {
  return {
    slots: computed(
      (): Slot[] =>
        modules.modules().map((module, index) => ({ index, module, title: sectionTitles[module] })),
      "tabBarMenu.slots",
    ),
    choices: slotModule.options.map((module): SlotChoice => ({
      module,
      title: sectionTitles[module],
    })),
    isSaving: computed(() => !modules.save.ready(), "tabBarMenu.isSaving"),
    failure: modules.failure,

    choose: action((index: number, module: SlotModule) => {
      if (!modules.save.ready()) {
        return;
      }

      const current = modules.modules();
      const next = withSlotChosen(current, index, module);

      if (next !== current) {
        telegram.haptics.select();
        modules.save(next).then(() => {
          if (modules.failure() !== undefined) {
            telegram.haptics.error();
          }
        }, noop);
      }
    }, "tabBarMenu.choose"),
  };
}

export type TabBarMenuModel = ReturnType<typeof reatomTabBarMenu>;
