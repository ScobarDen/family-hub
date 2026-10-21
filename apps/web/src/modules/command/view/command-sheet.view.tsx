import { reatomComponent } from "@reatom/react";
import { LoaderCircle, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button, FieldError } from "@/common/ui";

import type { CommandSheetModel } from "../vm/command-sheet.vm.ts";
import { DraftPreviewBlock } from "./draft-preview.view.tsx";

export type CommandSheetProps = { model: CommandSheetModel };

function heardOf(heard: string | null): ReactNode {
  return heard === null ? null : <p className="text-sm text-muted-foreground">«{heard}»</p>;
}

function contentOf(model: CommandSheetModel): ReactNode {
  const sheet = model.sheet();

  if (sheet.kind === "sending") {
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Слушаю…
      </p>
    );
  }

  if (sheet.kind === "created") {
    return <p className="text-lg font-semibold">Создано</p>;
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
        <DraftPreviewBlock model={model} preview={sheet.preview} />
        <FieldError>{sheet.error}</FieldError>
      </>
    )
  );
}

export const CommandSheet = reatomComponent(({ model }: CommandSheetProps) => {
  if (model.sheet().kind === "closed") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40">
      <section
        aria-label="Команда"
        className="relative mx-auto flex w-full max-w-lg flex-col gap-4 rounded-t-2xl bg-background p-4 pr-12 pb-[calc(var(--safe-area-bottom)+1rem)]"
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
        {contentOf(model)}
      </section>
    </div>
  );
}, "CommandSheet");
