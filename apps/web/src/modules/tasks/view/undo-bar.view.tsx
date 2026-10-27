import { reatomComponent } from "@reatom/react";

import type { TasksScreenModel } from "../vm/tasks.vm.ts";

// The live region stays mounted, so a screen reader announces the text when it appears; the page
// makes room for the bar through `data-undo`.
export const UndoBar = reatomComponent(({ model }: { model: TasksScreenModel }) => {
  const undo = model.undo();

  return (
    <div role="status" className="contents">
      {undo !== undefined && (
        <div
          data-undo
          className="fixed inset-x-4 bottom-[calc(var(--safe-area-bottom)+6rem)] z-50 mx-auto flex max-w-lg flex-wrap items-center gap-x-1 rounded-2xl border border-transparent bg-foreground py-2 pr-2 pl-4 text-background shadow-lg"
        >
          <span className="min-w-0 flex-1 basis-40 leading-snug break-words">
            Выполнено: «{undo.title}»
          </span>
          {/* Focus follows the tap that completed the row, so the keyboard can take it back. */}
          <button
            type="button"
            autoFocus
            className="min-h-11 px-2 font-semibold"
            onClick={model.undoCompletion}
          >
            Отменить
          </button>
          {undo.petId !== undefined && (
            <button
              type="button"
              className="min-h-11 px-2 font-semibold"
              onClick={model.recordCareEntry}
            >
              Записать в журнал
            </button>
          )}
          <button type="button" className="min-h-11 px-2 opacity-80" onClick={model.dismissUndo}>
            Скрыть
          </button>
        </div>
      )}
    </div>
  );
}, "UndoBar");
