import { action, computed } from "@reatom/core";

import type { AppModule, SlotModule } from "@family-hub/contract";

import { sectionOrderOf, sectionTitles, type NavigationTab } from "@/modules/sections";
import type { Haptics } from "@/modules/telegram";

export type SidebarItemId = Exclude<NavigationTab, "sections">;

export type SidebarItem = { id: SidebarItemId; title: string; isActive: boolean };

type SidebarDependencies = {
  slots: () => SlotModule[];
  activeTab: () => NavigationTab;
  onOpen: (item: SidebarItemId) => void;
  onAdd: () => void;
  telegram: { haptics: Pick<Haptics, "select"> };
  // A module may be renamed by its content, like the Pets after the Family's only Pet.
  titles?: () => Partial<Record<AppModule, string>>;
};

const fixedTitles = { today: "Сегодня", profile: "Профиль" } as const;

function modulesInOrder(slots: SlotModule[]): AppModule[] {
  const { slotted, rest } = sectionOrderOf(slots);

  return [...slotted, ...rest];
}

export function reatomSidebar({
  slots,
  activeTab,
  onOpen,
  onAdd,
  telegram,
  titles = () => ({}),
}: SidebarDependencies) {
  function itemOf(id: SidebarItemId): SidebarItem {
    const title =
      id === "today" || id === "profile" ? fixedTitles[id] : (titles()[id] ?? sectionTitles[id]);

    return { id, title, isActive: id === activeTab() };
  }

  return {
    items: computed(
      () => ["today" as const, ...modulesInOrder(slots())].map(itemOf),
      "sidebar.items",
    ),
    profile: computed(() => itemOf("profile"), "sidebar.profile"),

    // Clicking the active item again returns to its root, which is navigation and stays still.
    open: action((item: SidebarItemId) => {
      if (item !== activeTab()) {
        telegram.haptics.select();
      }

      onOpen(item);
    }, "sidebar.open"),
    add: onAdd,
  };
}

export type SidebarModel = ReturnType<typeof reatomSidebar>;
