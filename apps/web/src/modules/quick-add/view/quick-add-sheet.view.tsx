import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import type { AppModule } from "@family-hub/contract";

import { sectionColors, sectionIcons } from "@/modules/sections";
import { cn, Drawer, DrawerContent, DrawerTitle, FilePick } from "@/modules/ui";

import type { QuickAddModel } from "../quick-add.vm.ts";

const tileClass =
  "flex min-h-24 flex-col items-start justify-between gap-3 rounded-2xl bg-card p-4 text-left text-body font-medium shadow-sm ring-1 ring-border active:bg-accent";

function tileOf(module: AppModule, title: string): ReactNode {
  const Icon = sectionIcons[module];

  return (
    <>
      <Icon className={cn("size-6", sectionColors[module])} strokeWidth={1.75} aria-hidden />
      {title}
    </>
  );
}

export const QuickAddSheet = reatomComponent(
  ({ model }: { model: QuickAddModel }) => (
    <Drawer open={model.isOpen()} onClose={model.close}>
      <DrawerContent>
        <DrawerTitle className="sr-only">Добавить</DrawerTitle>
        <div className="grid grid-cols-2 gap-3 px-4 pt-2 pb-4">
          {model.tiles().map(({ title, module, target }) => (
            <button
              key={target.kind}
              type="button"
              className={tileClass}
              onClick={() => {
                model.add(target);
              }}
            >
              {tileOf(module, title)}
            </button>
          ))}
          {model.canAddPhoto() && (
            <FilePick className={tileClass} aria-label="Фото" onPick={model.addPhotos}>
              {tileOf("albums", "Фото")}
            </FilePick>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  ),
  "QuickAddSheet",
);
