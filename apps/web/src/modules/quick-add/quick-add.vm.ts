import { action, atom, computed } from "@reatom/core";

import type { AppModule } from "@family-hub/contract";

import type { Haptics } from "@/modules/telegram";

export type QuickAdd =
  | { kind: "new-task" }
  | { kind: "new-care-entry" }
  | { kind: "new-contribution"; goalId: string };

// A tile wears the icon and colour of the section its form opens in.
export type QuickAddTile = { title: string; module: AppModule; target: QuickAdd };

type QuickAddDependencies = {
  // A Contribution goes to the Savings Goal whose deadline is nearest; none means no tile.
  contributionGoalId: () => string | undefined;
  canAddPhoto: () => boolean;
  onQuickAdd: (target: QuickAdd) => void;
  onAddPhotos: (files: Blob[]) => void;
  telegram: { haptics: Pick<Haptics, "impact"> };
};

function tilesOf(goalId: string | undefined): QuickAddTile[] {
  return [
    { title: "Дело", module: "tasks", target: { kind: "new-task" } },
    { title: "Запись питомцу", module: "pet", target: { kind: "new-care-entry" } },
    ...(goalId === undefined
      ? []
      : [
          {
            title: "Взнос",
            module: "goals" as const,
            target: { kind: "new-contribution" as const, goalId },
          },
        ]),
  ];
}

export function reatomQuickAdd(dependencies: QuickAddDependencies) {
  const isOpen = atom(false, "quickAdd.isOpen");

  return {
    isOpen,
    tiles: computed(() => tilesOf(dependencies.contributionGoalId()), "quickAdd.tiles"),
    canAddPhoto: computed(() => dependencies.canAddPhoto(), "quickAdd.canAddPhoto"),

    open: action(() => {
      dependencies.telegram.haptics.impact("light");
      isOpen.set(true);
    }, "quickAdd.open"),
    close: action(() => {
      isOpen.set(false);
    }, "quickAdd.close"),
    add: action((target: QuickAdd) => {
      isOpen.set(false);
      dependencies.onQuickAdd(target);
    }, "quickAdd.add"),
    addPhotos: action((files: Blob[]) => {
      if (files.length === 0) {
        return;
      }

      isOpen.set(false);
      dependencies.onAddPhotos(files);
    }, "quickAdd.addPhotos"),
  };
}

export type QuickAddModel = ReturnType<typeof reatomQuickAdd>;
