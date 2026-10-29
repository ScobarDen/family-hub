import { action, computed } from "@reatom/core";

import type { SlotModule } from "@family-hub/contract";

import { sectionTitles } from "@/common/sections.config.ts";
import type { Haptics } from "@/modules/telegram";

import type { TabBarModules } from "../tab-bar.model.ts";

// Today and «Разделы» never move; the two slots between them are the Member's.
export type TabId = "today" | "sections" | SlotModule;

export type TabItem = { id: TabId; title: string; isActive: boolean };

type TabBarDependencies = {
  modules: Pick<TabBarModules, "modules">;
  activeTab: () => TabId;
  onOpen: (tab: TabId) => void;
  telegram: { haptics: Pick<Haptics, "select"> };
  // A slot may be renamed by its content, like the pet tab after the Family's only Pet.
  titles?: () => Partial<Record<SlotModule, string>>;
};

const fixedTitles = { today: "Сегодня", sections: "Разделы" } as const;

export function reatomTabBar({
  modules,
  activeTab,
  onOpen,
  telegram,
  titles = () => ({}),
}: TabBarDependencies) {
  function tabOf(id: TabId): TabItem {
    const title =
      id === "today" || id === "sections" ? fixedTitles[id] : (titles()[id] ?? sectionTitles[id]);

    return { id, title, isActive: id === activeTab() };
  }

  return {
    // The centre stays free for the microphone.
    tabs: computed(() => {
      const [first, second] = modules.modules();

      return {
        start: ["today" as const, ...(first === undefined ? [] : [first])].map(tabOf),
        end: [...(second === undefined ? [] : [second]), "sections" as const].map(tabOf),
      };
    }, "tabBar.tabs"),

    // Tapping the active tab again returns to its root, which is navigation and stays still.
    open: action((tab: TabId) => {
      if (tab !== activeTab()) {
        telegram.haptics.select();
      }

      onOpen(tab);
    }, "tabBar.open"),
  };
}

export type TabBarModel = ReturnType<typeof reatomTabBar>;
