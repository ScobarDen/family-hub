import { action, computed } from "@reatom/core";

import { appModule, type AppModule } from "@family-hub/contract";

import { sectionTitles } from "@/common/sections";

import type { TabBarModules } from "../tab-bar.model.ts";

export type QuickAdd =
  | { kind: "new-plan" }
  | { kind: "new-event" }
  | { kind: "new-care-entry" }
  | { kind: "new-contribution"; goalId: string };

export type SectionRow = { module: AppModule; title: string };

export type QuickAddButton = { title: string; target: QuickAdd };

type SectionsDependencies = {
  modules: Pick<TabBarModules, "modules">;
  // A Contribution goes to the Savings Goal whose deadline is nearest; none means no button.
  contributionGoalId: () => string | undefined;
  canAddPhoto: () => boolean;
  onOpen: (module: AppModule) => void;
  onQuickAdd: (target: QuickAdd) => void;
  onAddPhotos: (files: Blob[]) => void;
  onConfigure: () => void;
  onOpenSettings: () => void;
};

function rowsOf(modules: AppModule[]) {
  return modules.map((module): SectionRow => ({ module, title: sectionTitles[module] }));
}

function quickAddsOf(goalId: string | undefined): QuickAddButton[] {
  return [
    { title: "План", target: { kind: "new-plan" } },
    { title: "Событие", target: { kind: "new-event" } },
    { title: "Запись питомцу", target: { kind: "new-care-entry" } },
    ...(goalId === undefined
      ? []
      : [{ title: "Взнос", target: { kind: "new-contribution" as const, goalId } }]),
  ];
}

export function reatomSections(dependencies: SectionsDependencies) {
  const { modules } = dependencies;

  return {
    slotted: computed(() => rowsOf(modules.modules()), "sections.slotted"),
    rest: computed(() => {
      const slots: AppModule[] = modules.modules();

      return rowsOf(appModule.options.filter((module) => !slots.includes(module)));
    }, "sections.rest"),
    quickAdds: computed(() => quickAddsOf(dependencies.contributionGoalId()), "sections.quickAdds"),
    canAddPhoto: computed(() => dependencies.canAddPhoto(), "sections.canAddPhoto"),

    open: action((module: AppModule) => {
      dependencies.onOpen(module);
    }, "sections.open"),
    quickAdd: action((target: QuickAdd) => {
      dependencies.onQuickAdd(target);
    }, "sections.quickAdd"),
    addPhotos: action((files: Blob[]) => {
      if (files.length > 0) {
        dependencies.onAddPhotos(files);
      }
    }, "sections.addPhotos"),
    configure: action(() => {
      dependencies.onConfigure();
    }, "sections.configure"),
    openSettings: action(() => {
      dependencies.onOpenSettings();
    }, "sections.openSettings"),
  };
}

export type SectionsModel = ReturnType<typeof reatomSections>;
