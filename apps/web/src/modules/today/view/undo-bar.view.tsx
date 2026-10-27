import { reatomComponent } from "@reatom/react";

import type { TodayModel } from "../vm/today.vm.ts";

// The live region stays mounted, so a screen reader announces the text when it appears; the page
// makes room for the bar through `data-undo`.
export const UndoBar = reatomComponent(({ model }: { model: TodayModel }) => {
  const undo = model.undo();
  const failure = model.completionFailure();
  const message = undo === undefined ? failure : `Выполнено: «${undo.title}»`;

  return (
    <div role="status" className="contents">
      {message !== undefined && (
        <div
          data-undo
          className="fixed inset-x-4 bottom-[calc(var(--safe-area-bottom)+6rem)] z-50 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-transparent bg-foreground px-4 py-3 text-background shadow-lg"
        >
          <span className="min-w-0 flex-1 leading-snug break-words">{message}</span>
          {undo === undefined ? (
            <button type="button" className="font-semibold" onClick={model.dismissFailure}>
              Скрыть
            </button>
          ) : (
            <>
              {/* Focus follows the tap that completed the row, so the keyboard can take it back. */}
              <button type="button" autoFocus className="font-semibold" onClick={model.revert}>
                Отменить
              </button>
              {undo.hasPet && (
                <button type="button" className="font-semibold" onClick={model.recordCareEntry}>
                  Записать в журнал
                </button>
              )}
              <button type="button" className="opacity-80" onClick={model.dismissUndo}>
                Скрыть
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}, "UndoBar");
