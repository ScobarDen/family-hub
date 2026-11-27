import { CircleUser, House, type LucideIcon } from "lucide-react";

import { sectionIcons } from "@/modules/sections";

import type { SidebarItem as Item, SidebarItemId } from "../sidebar.vm.ts";

type SidebarItemProps = { item: Item; onOpen: (item: SidebarItemId) => void };

const itemIcons: Record<SidebarItemId, LucideIcon> = {
  ...sectionIcons,
  today: House,
  profile: CircleUser,
};

export function SidebarItem({ item, onOpen }: SidebarItemProps) {
  const Icon = itemIcons[item.id];

  return (
    <button
      type="button"
      aria-current={item.isActive ? "page" : undefined}
      className="group press flex w-full min-w-0 items-center gap-3 px-3 py-2 text-left text-subhead font-medium text-foreground hover:bg-accent aria-[current=page]:text-primary-text android:rounded-full android:aria-[current=page]:bg-primary/15 ios:rounded-lg ios:aria-[current=page]:bg-primary/10"
      onClick={() => {
        onOpen(item.id);
      }}
    >
      <Icon
        className="size-5 shrink-0 fill-transparent text-muted-foreground group-aria-[current=page]:fill-primary/30 group-aria-[current=page]:text-primary"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="truncate">{item.title}</span>
    </button>
  );
}
