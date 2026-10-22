import { CalendarClock, CalendarPlus, Syringe, TriangleAlert } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import type { SoonItem } from "../pets.lib.ts";

type PetSoonProps = {
  soon: SoonItem[];
  onOpen: (item: SoonItem) => void;
  onPlan: (() => void) | undefined;
};

function iconOf(item: SoonItem) {
  if (item.isOverdue) {
    return TriangleAlert;
  }

  return item.kind === "due" ? Syringe : CalendarClock;
}

export function PetSoon({ soon, onOpen, onPlan }: PetSoonProps) {
  return (
    <Section title="Скоро">
      {soon.length === 0 && <SectionItem icon={CalendarClock} title="Ближайших дел нет" />}
      {soon.map((item) => (
        <SectionItem
          key={`${item.kind}-${item.id}`}
          icon={iconOf(item)}
          isAlert={item.isOverdue}
          title={item.title}
          subtitle={item.subtitle}
          onClick={() => {
            onOpen(item);
          }}
        />
      ))}
      {onPlan !== undefined && (
        <SectionItem icon={CalendarPlus} title="Запланировать" onClick={onPlan} />
      )}
    </Section>
  );
}
