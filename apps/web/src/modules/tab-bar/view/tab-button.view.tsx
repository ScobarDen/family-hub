import { House, LayoutGrid, type LucideIcon } from "lucide-react";

import { sectionIcons } from "@/common/sections";

import type { TabId, TabItem } from "../vm/tab-bar.vm.ts";

type TabButtonProps = { tab: TabItem; onOpen: (tab: TabId) => void };

const tabIcons: Record<TabId, LucideIcon> = { ...sectionIcons, today: House, sections: LayoutGrid };

export function TabButton({ tab, onOpen }: TabButtonProps) {
  const Icon = tabIcons[tab.id];

  return (
    <button
      type="button"
      aria-current={tab.isActive ? "page" : undefined}
      className="group flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-muted-foreground transition-colors aria-[current=page]:text-foreground"
      onClick={() => {
        onOpen(tab.id);
      }}
    >
      <span className="flex rounded-full px-3 py-0.5 transition-colors group-aria-[current=page]:bg-primary/15">
        <Icon
          className="size-6 group-aria-[current=page]:text-primary"
          strokeWidth={1.75}
          aria-hidden
        />
      </span>
      <span className="max-w-full truncate text-[0.625rem] leading-tight font-medium group-aria-[current=page]:font-semibold">
        {tab.title}
      </span>
    </button>
  );
}
