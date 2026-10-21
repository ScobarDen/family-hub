import { reatomComponent } from "@reatom/react";
import { Plus } from "lucide-react";

import { formatDate } from "@/common/format-date";
import { Section, SectionItem } from "@/common/ui";

import type { CalendarModel } from "../vm/calendar.vm.ts";
import { Agenda } from "./agenda.view.tsx";
import { EventDetails } from "./event-details.view.tsx";
import { EventForm } from "./event-form.view.tsx";
import { MonthGrid } from "./month-grid.view.tsx";

export type CalendarProps = { model: CalendarModel };

export const Calendar = reatomComponent(({ model }: CalendarProps) => {
  const screen = model.screen();

  if (screen.kind === "event") {
    return <EventDetails model={model} />;
  }

  if (screen.kind === "event-form") {
    return <EventForm model={model.form} onCancel={model.back} />;
  }

  return (
    <>
      <MonthGrid model={model} />
      <Agenda
        title={formatDate(model.selected())}
        items={model.dayItems()}
        isDated={false}
        empty="Ничего не запланировано"
        onOpen={model.openItem}
      />
      <Section>
        <SectionItem icon={Plus} tone="green" title="Новое событие" onClick={model.add} />
      </Section>
      <Agenda
        title="Ближайшее"
        items={model.upcoming()}
        isDated
        empty="В ближайший месяц ничего нет"
        onOpen={model.openItem}
      />
    </>
  );
}, "Calendar");
