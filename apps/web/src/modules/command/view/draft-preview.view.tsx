import type { ReactNode } from "react";

import type { DraftPreview } from "@family-hub/commands";

import { Button } from "@/modules/ui";

import type { CommandSheetModel } from "../vm/command-sheet.vm.ts";

function questionOf(model: CommandSheetModel, question: DraftPreview["question"]): ReactNode {
  return (
    question !== undefined && (
      <div className="flex flex-col gap-2">
        <p className="text-sm">{question.title}</p>
        {question.candidates.map((candidate) => (
          <Button
            key={candidate.index}
            variant="secondary"
            onClick={() => {
              model.pick(candidate.index);
            }}
          >
            {candidate.name}
          </Button>
        ))}
      </div>
    )
  );
}

// Telegram's own bottom buttons take «Создать» and «Изменить» where the client has them.
function actionsOf(
  model: CommandSheetModel,
  preview: DraftPreview,
  isCreating: boolean,
): ReactNode {
  return (
    !model.hasNativeButtons && (
      <div className="flex gap-2">
        {preview.canCreate && (
          <Button size="lg" className="flex-1" isPending={isCreating} onClick={model.create}>
            Создать
          </Button>
        )}
        <Button
          size="lg"
          variant="secondary"
          className="flex-1"
          disabled={isCreating}
          onClick={model.edit}
        >
          Изменить
        </Button>
      </div>
    )
  );
}

export function DraftPreviewBlock({
  model,
  preview,
  isCreating,
}: {
  model: CommandSheetModel;
  preview: DraftPreview;
  isCreating: boolean;
}) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-lg font-semibold">{preview.title}</span>
        <span className="text-sm text-muted-foreground">{preview.details.join(" · ")}</span>
      </div>
      {preview.missing !== undefined && <p className="text-sm">{preview.missing}</p>}
      {preview.hint !== undefined && (
        <p className="text-sm text-muted-foreground">{preview.hint}</p>
      )}
      {questionOf(model, preview.question)}
      {actionsOf(model, preview, isCreating)}
    </>
  );
}
