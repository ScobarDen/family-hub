import { reatomComponent } from "@reatom/react";

import { floatingBarClass, LiveRegion } from "@/common/ui";

import type { TasksScreenModel } from "../vm/tasks.vm.ts";

// The live region stays mounted, so a screen reader announces the text when it appears; the page
// makes room for the bar through `data-undo`.
export const UndoBar = reatomComponent(({ model }: { model: TasksScreenModel }) => {
  const undo = model.undo();

  return (
    <LiveRegion className="absolute">
      {undo !== undefined && (
        <div data-undo className={floatingBarClass}>
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
    </LiveRegion>
  );
}, "UndoBar");
