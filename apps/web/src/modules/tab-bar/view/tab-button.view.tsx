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
      className="group press flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1.5 text-muted-foreground transition-colors aria-[current=page]:text-primary"
      onClick={() => {
        onOpen(tab.id);
      }}
    >
      <Icon
        className="size-7 fill-transparent transition-[fill] group-aria-[current=page]:fill-primary/25 motion-safe:group-aria-[current=page]:animate-tab-pop"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="max-w-full truncate text-tab-label font-medium">{tab.title}</span>
    </button>
  );
}
