import { ChevronDown, ChevronUp } from "lucide-react";

import type { AppModule } from "@family-hub/contract";

import { Button } from "@/common/ui";

import type { TabBarMenuItem } from "../vm/tab-bar-menu.vm.ts";

type TabBarMoveButtonsProps = {
  item: TabBarMenuItem;
  onMoveUp: (module: AppModule) => void;
  onMoveDown: (module: AppModule) => void;
};

export function TabBarMoveButtons({ item, onMoveUp, onMoveDown }: TabBarMoveButtonsProps) {
  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`${item.title} — выше`}
        disabled={!item.canMoveUp}
        onClick={() => {
          onMoveUp(item.module);
        }}
      >
        <ChevronUp />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`${item.title} — ниже`}
        disabled={!item.canMoveDown}
        onClick={() => {
          onMoveDown(item.module);
        }}
      >
        <ChevronDown />
      </Button>
    </>
  );
}
