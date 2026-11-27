import { action, computed } from "@reatom/core";

import type { AppModule } from "@family-hub/contract";

import { sectionOrderOf, sectionTitles } from "@/modules/sections";

import type { TabBarModules } from "../tab-bar.model.ts";

export type SectionRow = { module: AppModule; title: string };

type SectionsDependencies = {
  modules: Pick<TabBarModules, "modules">;
  onOpen: (module: AppModule) => void;
  onConfigure: () => void;
  onOpenSettings: () => void;
};

function rowsOf(modules: AppModule[]) {
  return modules.map((module): SectionRow => ({ module, title: sectionTitles[module] }));
}

export function reatomSections(dependencies: SectionsDependencies) {
  const { modules } = dependencies;

  return {
    slotted: computed(() => rowsOf(sectionOrderOf(modules.modules()).slotted), "sections.slotted"),
    rest: computed(() => rowsOf(sectionOrderOf(modules.modules()).rest), "sections.rest"),

    open: action((module: AppModule) => {
      dependencies.onOpen(module);
    }, "sections.open"),
    configure: action(() => {
      dependencies.onConfigure();
    }, "sections.configure"),
    openSettings: action(() => {
      dependencies.onOpenSettings();
    }, "sections.openSettings"),
  };
}

export type SectionsModel = ReturnType<typeof reatomSections>;
