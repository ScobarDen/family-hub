import { reatomComponent } from "@reatom/react";

import type { TodayModel } from "../vm/today.vm.ts";

// Floats above the tab bar while the one-tap Completed can still be taken back.
export const UndoBar = reatomComponent(({ model }: { model: TodayModel }) => {
  const undo = model.undo();

  return (
    undo !== undefined && (
      <div
        role="status"
        className="fixed inset-x-4 bottom-[calc(var(--safe-area-bottom)+6rem)] z-50 mx-auto flex max-w-lg items-center gap-3 rounded-xl bg-foreground px-4 py-3 text-background shadow-lg"
      >
        <span className="min-w-0 flex-1 truncate">«{undo.title}» выполнено</span>
        <button type="button" className="font-semibold" onClick={model.revert}>
          Отменить
        </button>
      </div>
    )
  );
}, "UndoBar");
