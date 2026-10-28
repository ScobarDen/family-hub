import { reatomComponent } from "@reatom/react";
import { LoaderCircle, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, FieldError, ModalDialog } from "@/common/ui";

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
    <ModalDialog
      isOpen={isOpen}
      onClose={model.close}
      aria-label="Команда"
      inert={!isOpen}
      data-open={isOpen || undefined}
      className="items-end bg-black/40 transition-[opacity,display,overlay] transition-discrete duration-150 ease-out not-data-open:opacity-0 data-open:flex data-open:duration-300 starting:opacity-0"
    >
      <div
        data-open={isOpen || undefined}
        className="relative mx-auto flex w-full max-w-lg flex-col gap-4 rounded-t-2xl bg-background p-4 pr-12 pb-[calc(var(--safe-area-bottom)+1rem)] transition-[translate] duration-150 ease-out data-open:duration-300 motion-safe:not-data-open:translate-y-3 motion-safe:starting:translate-y-full"
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Закрыть"
          className="absolute top-2 right-2"
          onClick={model.close}
        >
          <X className="size-5" />
        </Button>
        <div role="status" className="contents">
          {contentOf(model, shown)}
        </div>
      </div>
    </ModalDialog>
  );
}, "CommandSheet");
