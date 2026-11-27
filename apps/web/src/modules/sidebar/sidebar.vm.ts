import { action, computed } from "@reatom/core";

import { appModule, type AppModule, type SlotModule } from "@family-hub/contract";

import { sectionTitles } from "@/modules/sections";
import type { Haptics } from "@/modules/telegram";

export type SidebarItemId = "today" | AppModule | "profile";

export type SidebarItem = { id: SidebarItemId; title: string; isActive: boolean };

type SidebarDependencies = {
  slots: () => SlotModule[];
  activeTab: () => string;
  onOpen: (item: SidebarItemId) => void;
  onAdd: () => void;
  telegram: { haptics: Pick<Haptics, "select"> };
  // A module may be renamed by its content, like the Pets after the Family's only Pet.
  titles?: () => Partial<Record<AppModule, string>>;
};

const fixedTitles = { today: "Сегодня", profile: "Профиль" } as const;

// The «Разделы» order: the Member's slots first, then the rest as the app lists them.
function modulesInOrder(slots: SlotModule[]): AppModule[] {
  const rest = appModule.options.filter((module) => !(slots as AppModule[]).includes(module));

  return [...slots, ...rest];
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
    add: action(() => {
      onAdd();
    }, "sidebar.add"),
  };
}

export type SidebarModel = ReturnType<typeof reatomSidebar>;
