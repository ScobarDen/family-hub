import { reatomComponent } from "@reatom/react";

import { SectionItem } from "@/common/ui";

import { moduleIcons } from "../tab-bar.config.ts";
import type { TabBarModel } from "../vm/tab-bar.vm.ts";

export type HiddenModulesProps = { model: TabBarModel };

export const HiddenModules = reatomComponent(
  ({ model }: HiddenModulesProps) =>
    model.hidden().map(({ module, title }) => (
      <SectionItem
        key={module}
        icon={moduleIcons[module]}
        title={title}
        onClick={() => {
          model.open(module);
        }}
      />
    )),
  "HiddenModules",
);
