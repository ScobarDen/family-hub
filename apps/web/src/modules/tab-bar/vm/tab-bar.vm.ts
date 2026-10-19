import { action, computed } from "@reatom/core";

import { appModule, type AppModule } from "@family-hub/contract";

import { moduleTitles } from "../tab-bar.config.ts";
import type { TabBarModules } from "../tab-bar.model.ts";

export type Tab = { module: AppModule; title: string; isActive: boolean };

export type HiddenModule = { module: AppModule; title: string };

const sides = 2;

type TabBarDependencies = {
  modules: Pick<TabBarModules, "modules">;
  activeModule: () => AppModule | undefined;
  onOpen: (module: AppModule) => void;
};

export function reatomTabBar({ modules, activeModule, onOpen }: TabBarDependencies) {
  return {
    // The centre stays free for the microphone; the odd tab goes to its left.
    tabs: computed(() => {
      const tabs = modules.modules().map((module) => ({
        module,
        title: moduleTitles[module],
        isActive: module === activeModule(),
      }));
      const middle = Math.ceil(tabs.length / sides);

      return { start: tabs.slice(0, middle), end: tabs.slice(middle) };
    }, "tabBar.tabs"),

    hidden: computed(
      (): HiddenModule[] =>
        appModule.options
          .filter((module) => !modules.modules().includes(module))
          .map((module) => ({ module, title: moduleTitles[module] })),
      "tabBar.hidden",
    ),

    open: action((module: AppModule) => {
      onOpen(module);
    }, "tabBar.open"),
  };
}

export type TabBarModel = ReturnType<typeof reatomTabBar>;
