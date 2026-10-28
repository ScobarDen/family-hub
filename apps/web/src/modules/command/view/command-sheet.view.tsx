import { reatomComponent } from "@reatom/react";
import { LoaderCircle, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, Drawer, DrawerContent, DrawerTitle, FieldError, LiveRegion } from "@/common/ui";

import type { CommandSheet as SheetState, CommandSheetModel } from "../vm/command-sheet.vm.ts";
import { DraftPreviewBlock } from "./draft-preview.view.tsx";

export type CommandSheetProps = { model: CommandSheetModel };

function heardOf(heard: string | null): ReactNode {
  return heard === null ? null : <p className="text-sm text-muted-foreground">«{heard}»</p>;
}

function contentOf(model: CommandSheetModel, sheet: SheetState): ReactNode {
  if (sheet.kind === "sending") {
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Распознаю…
      </p>
    );
  }

  if (sheet.kind === "created") {
    return <p className="text-lg font-semibold">{sheet.message}</p>;
  }

  if (sheet.kind === "failure") {
    return (
      <>
        {heardOf(sheet.heard)}
        <p className="whitespace-pre-line">{sheet.message}</p>
      </>
    );
  }

  return (
    sheet.kind === "draft" && (
      <>
        {heardOf(sheet.heard)}
        <DraftPreviewBlock model={model} preview={sheet.preview} isCreating={sheet.isCreating} />
        <FieldError>{sheet.error}</FieldError>
      </>
    )
  );
}

// The sheet stays mounted and keeps showing its last content while it slides away.
export const CommandSheet = reatomComponent(({ model }: CommandSheetProps) => {
  const sheet = model.sheet();
  const isOpen = sheet.kind !== "closed";
  const [shown, setShown] = useState(sheet);

  if (isOpen && shown !== sheet) {
    setShown(sheet);
  }

  return (
    <Drawer open={isOpen} onClose={model.close}>
      <DrawerContent keepMounted>
        <DrawerTitle className="sr-only">Команда</DrawerTitle>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Закрыть"
          className="absolute top-2 right-2"
          onClick={model.close}
        >
          <X className="size-5" />
        </Button>
        <LiveRegion className="flex flex-col gap-4 px-4 pt-2 pr-12 pb-4">
          {contentOf(model, shown)}
        </LiveRegion>
      </DrawerContent>
    </Drawer>
  );
}, "CommandSheet");
