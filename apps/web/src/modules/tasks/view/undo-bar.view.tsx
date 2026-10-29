import { reatomComponent } from "@reatom/react";

import { floatingBarClass, LiveRegion } from "@/modules/ui";

import type { TasksScreenModel } from "../vm/tasks.vm.ts";

// Only the text sits in the live region, mounted before it appears, so the buttons are not read
// with it; the page makes room for the bar through `data-undo`.
export const UndoBar = reatomComponent(({ model }: { model: TasksScreenModel }) => {
  const undo = model.undo();

  return (
    <div
      data-undo={undo !== undefined || undefined}
      className={undo === undefined ? "absolute" : floatingBarClass}
    >
      <LiveRegion className="min-w-0 flex-1 basis-40 leading-snug break-words">
        {undo !== undefined && `Выполнено: «${undo.title}»`}
      </LiveRegion>
      {undo !== undefined && (
        <>
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
        </>
      )}
    </div>
  );
}, "UndoBar");
