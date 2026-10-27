import { reatomComponent } from "@reatom/react";

import type { TasksScreenModel } from "../vm/tasks.vm.ts";
import { Agenda } from "./agenda.view.tsx";
import { MonthGrid } from "./month-grid.view.tsx";

export const TaskCalendar = reatomComponent(
  ({ model }: { model: TasksScreenModel }) => (
    <>
      <MonthGrid model={model} />
      <Agenda
        title={model.dayTitle()}
        rows={model.dayRows()}
        empty="Ничего не запланировано"
        onOpen={model.openItem}
      />
    </>
  ),
  "TaskCalendar",
);
