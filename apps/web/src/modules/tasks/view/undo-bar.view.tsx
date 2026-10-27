import { reatomComponent } from "@reatom/react";
import { useEffect } from "react";

import { Button } from "@/common/ui";

import type { TasksScreenModel } from "../vm/tasks.vm.ts";

const shownMs = 6000;

function Bar({
  model,
  title,
  hasPet,
}: {
  model: TasksScreenModel;
  title: string;
  hasPet: boolean;
}) {
  useEffect(() => {
    const timer = setTimeout(model.dismissUndo, shownMs);

    return () => {
      clearTimeout(timer);
    };
  }, [model]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(var(--tg-safe-area-inset-bottom,0px)+5rem)] z-20 flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2 text-background shadow-lg"
    >
      <span className="min-w-0 flex-1 truncate text-sm">Выполнено: {title}</span>
      {hasPet && (
        <Button size="sm" variant="secondary" onClick={model.recordCareEntry}>
          Записать в журнал
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={model.undoCompletion}>
        Отменить
      </Button>
    </div>
  );
}

export const UndoBar = reatomComponent(({ model }: { model: TasksScreenModel }) => {
  const undo = model.undo();

  return undo === undefined ? null : (
    <Bar
      key={`${undo.taskId}-${undo.occurrence ?? ""}`}
      model={model}
      title={undo.title}
      hasPet={undo.petId !== undefined}
    />
  );
}, "UndoBar");
