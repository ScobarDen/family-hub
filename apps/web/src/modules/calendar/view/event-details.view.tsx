import { reatomComponent } from "@reatom/react";
import { CalendarX, Lock, Pencil, Repeat, Trash2 } from "lucide-react";

import { FieldError, Section, SectionItem } from "@/common/ui";

import type { CalendarModel } from "../vm/calendar.vm.ts";
import type { EventDetails as EventDetailsData } from "../vm/event-details.vm.ts";

type EventDetailsProps = { model: CalendarModel };

function EventFacts({ details, model }: { details: EventDetailsData; model: CalendarModel }) {
  return (
    <>
      <SectionItem
        icon={details.isPrivate ? Lock : undefined}
        tone="gray"
        title={details.when}
        subtitle={details.note}
      />
      {details.repeats !== undefined && (
        <SectionItem icon={Repeat} tone="blue" title={details.repeats} />
      )}
      <SectionItem icon={Pencil} tone="blue" title="Изменить" onClick={model.edit} />
      {details.isRecurring && (
        <SectionItem
          icon={CalendarX}
          tone="orange"
          title="Пропустить этот раз"
          onClick={model.details.skipOccurrence}
        />
      )}
    </>
  );
}

export const EventDetails = reatomComponent(({ model }: EventDetailsProps) => {
  const details = model.details.details();

  if (details === undefined) {
    return (
      <Section>
        <SectionItem title="Событие не найдено" />
      </Section>
    );
  }

  return (
    <>
      <Section footer={<FieldError>{model.details.failure()}</FieldError>}>
        <EventFacts details={details} model={model} />
      </Section>
      {details.canDelete && (
        <Section>
          <SectionItem
            icon={Trash2}
            tone="red"
            title="Удалить событие"
            onClick={model.details.removeEvent}
          />
        </Section>
      )}
    </>
  );
}, "EventDetails");
