import { reatomComponent } from "@reatom/react";

import { floatingBarClass } from "@/common/ui";

import type { TodayModel } from "../vm/today.vm.ts";

const actionClass = "min-h-11 px-2 font-semibold";

function UndoActions({ model, hasPet }: { model: TodayModel; hasPet: boolean }) {
  return (
    <>
      {/* Focus follows the tap that completed the row, so the keyboard can take it back. */}
      <button type="button" autoFocus className={actionClass} onClick={model.revert}>
        Отменить
      </button>
      {hasPet && (
        <button type="button" className={actionClass} onClick={model.recordCareEntry}>
          Записать в журнал
        </button>
      )}
      <button type="button" className="min-h-11 px-2 opacity-80" onClick={model.dismissUndo}>
        Скрыть
      </button>
    </>
  );
}

// The live region stays mounted, so a screen reader announces the text when it appears; the page
// makes room for the bar through `data-undo`.
export const UndoBar = reatomComponent(({ model }: { model: TodayModel }) => {
  const undo = model.undo();

  return (
    <div role="status" className="contents">
      {undo !== undefined && (
        <div data-undo className={floatingBarClass}>
          <span className="min-w-0 flex-1 basis-40 leading-snug break-words">
            Выполнено: «{undo.title}»
          </span>
          <UndoActions model={model} hasPet={undo.hasPet} />
        </div>
      )}
    </div>
  );
}, "UndoBar");
