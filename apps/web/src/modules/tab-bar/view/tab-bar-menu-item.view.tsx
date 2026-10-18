import type { AppModule } from "@family-hub/contract";

import { SectionItem, Switch } from "@/common/ui";

import { moduleIcons, moduleTones } from "../tab-bar.config.ts";
import type { TabBarMenuItem as Item } from "../vm/tab-bar-menu.vm.ts";
import { TabBarMoveButtons } from "./tab-bar-move-buttons.view.tsx";

type TabBarMenuItemProps = {
  item: Item;
  onToggle: (module: AppModule) => void;
  onMoveUp: (module: AppModule) => void;
  onMoveDown: (module: AppModule) => void;
};

export function TabBarMenuItem({ item, onToggle, onMoveUp, onMoveDown }: TabBarMenuItemProps) {
  return (
    <SectionItem
      icon={moduleIcons[item.module]}
      tone={moduleTones[item.module]}
      title={item.title}
      after={
        <span className="flex items-center gap-1">
          {item.isEnabled && (
            <TabBarMoveButtons item={item} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
          )}
          <Switch
            aria-label={item.title}
            checked={item.isEnabled}
            disabled={!item.canToggle}
            onCheckedChange={() => {
              onToggle(item.module);
            }}
          />
        </span>
      }
    />
  );
}
