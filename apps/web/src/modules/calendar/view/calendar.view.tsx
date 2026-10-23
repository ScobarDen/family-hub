import { reatomComponent } from "@reatom/react";
import { BellPlus, Plus } from "lucide-react";

import { Button } from "@/common/ui";

import type { CalendarModel } from "../vm/calendar.vm.ts";
import { Agenda } from "./agenda.view.tsx";
import { EventDetails } from "./event-details.view.tsx";
import { EventForm } from "./event-form.view.tsx";
import { MonthGrid } from "./month-grid.view.tsx";
import { ReminderForm } from "./reminder-form.view.tsx";

export type CalendarProps = { model: CalendarModel };

export const Calendar = reatomComponent(({ model }: CalendarProps) => {
  const screen = model.screen();

  if (screen.kind === "event") {
    return <EventDetails model={model} />;
  }

  if (screen.kind === "event-form") {
    return <EventForm model={model.form} onCancel={model.back} />;
  }

  if (screen.kind === "reminder-form") {
    return <ReminderForm model={model.reminderForm} onCancel={model.back} />;
  }

  return (
    <>
      <MonthGrid model={model} />
      <div className="grid grid-cols-2 gap-2 px-4 pb-7">
        <Button className="h-11" onClick={model.add}>
          <Plus /> Событие
        </Button>
        <Button className="h-11 bg-card" variant="secondary" onClick={model.addReminder}>
          <BellPlus /> Напоминание
        </Button>
      </div>
      <Agenda
        title={model.dayTitle()}
        rows={model.dayRows()}
        empty="Ничего не запланировано"
        onOpen={model.openItem}
      />
      <Agenda
        title="Ближайшее"
        rows={model.upcomingRows()}
        empty="В ближайший месяц ничего нет"
        onOpen={model.openItem}
      />
    </>
  );
}, "Calendar");
