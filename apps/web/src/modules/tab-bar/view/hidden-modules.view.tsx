import { reatomComponent } from "@reatom/react";

import { SectionItem } from "@/common/ui";

import { moduleIcons, moduleTones } from "../tab-bar.config.ts";
import type { TabBarModel } from "../vm/tab-bar.vm.ts";

export type HiddenModulesProps = { model: TabBarModel };

export const HiddenModules = reatomComponent(
  ({ model }: HiddenModulesProps) =>
    model.hidden().map(({ module, title }) => (
      <SectionItem
        key={module}
        icon={moduleIcons[module]}
        tone={moduleTones[module]}
        title={title}
        onClick={() => {
          model.open(module);
        }}
      />
    )),
  "HiddenModules",
);
