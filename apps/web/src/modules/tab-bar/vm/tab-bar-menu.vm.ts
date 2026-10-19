import { action, computed, noop } from "@reatom/core";

import {
  appModule,
  tabBarMaxModules,
  tabBarMinModules,
  type AppModule,
} from "@family-hub/contract";

import { moduleTitles } from "../tab-bar.config.ts";
import type { TabBarModules } from "../tab-bar.model.ts";

export type TabBarMenuItem = {
  module: AppModule;
  title: string;
  isEnabled: boolean;
  canToggle: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

type Step = -1 | 1;

function moved(modules: AppModule[], module: AppModule, step: Step): AppModule[] {
  const from = modules.indexOf(module);
  const to = from + step;

  if (from === -1 || to < 0 || to >= modules.length) {
    return modules;
  }

  const next = modules.filter((other) => other !== module);

  next.splice(to, 0, module);

  return next;
}

function itemsOf(modules: AppModule[]): TabBarMenuItem[] {
  const hidden = appModule.options.filter((module) => !modules.includes(module));
  const enabledItems = modules.map((module, index) => ({
    module,
    title: moduleTitles[module],
    isEnabled: true,
    canToggle: modules.length > tabBarMinModules,
    canMoveUp: index > 0,
    canMoveDown: index < modules.length - 1,
  }));
  const hiddenItems = hidden.map((module) => ({
    module,
    title: moduleTitles[module],
    isEnabled: false,
    canToggle: modules.length < tabBarMaxModules,
    canMoveUp: false,
    canMoveDown: false,
  }));

  return [...enabledItems, ...hiddenItems];
}

export function reatomTabBarMenu({ modules }: { modules: TabBarModules }) {
  const items = computed(() => itemsOf(modules.modules()), "tabBarMenu.items");

  function change(next: AppModule[]): void {
    if (next !== modules.modules()) {
      modules.save(next).catch(noop);
    }
  }

  return {
    items,
    isSaving: computed(() => !modules.save.ready(), "tabBarMenu.isSaving"),
    failure: modules.failure,

    toggle: action((module: AppModule) => {
      const item = items().find((candidate) => candidate.module === module);
      const current = modules.modules();

      if (item?.canToggle !== true) {
        return;
      }

      change(item.isEnabled ? current.filter((other) => other !== module) : [...current, module]);
    }, "tabBarMenu.toggle"),
    moveUp: action((module: AppModule) => {
      change(moved(modules.modules(), module, -1));
    }, "tabBarMenu.moveUp"),
    moveDown: action((module: AppModule) => {
      change(moved(modules.modules(), module, 1));
    }, "tabBarMenu.moveDown"),
  };
}

export type TabBarMenuModel = ReturnType<typeof reatomTabBarMenu>;
