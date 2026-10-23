import { reatomComponent } from "@reatom/react";

import type { TodayModel } from "../vm/today.vm.ts";

export const UndoBar = reatomComponent(({ model }: { model: TodayModel }) => {
  const undo = model.undo();
  const failure = model.completionFailure();

  if (undo === undefined && failure === undefined) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(var(--safe-area-bottom)+6rem)] z-50 mx-auto flex max-w-lg items-center gap-3 rounded-xl bg-foreground px-4 py-3 text-background shadow-lg"
    >
      <span className="min-w-0 flex-1 truncate">
        {undo === undefined ? failure : `«${undo.title}» выполнено`}
      </span>
      {undo !== undefined && (
        <button type="button" className="font-semibold" onClick={model.revert}>
          Отменить
        </button>
      )}
    </div>
  );
}, "UndoBar");
