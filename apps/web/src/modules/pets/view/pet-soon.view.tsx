import { CalendarClock, CalendarPlus, TriangleAlert } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import type { SoonItem } from "../pets.lib.ts";

type PetSoonProps = {
  soon: SoonItem[];
  onOpenPlan: (planId: string) => void;
  onPlan: () => void;
};

export function PetSoon({ soon, onOpenPlan, onPlan }: PetSoonProps) {
  return (
    <Section title="Скоро">
      {soon.length === 0 && (
        <SectionItem icon={CalendarClock} tone="gray" title="Ближайших дел нет" />
      )}
      {soon.map((item) => (
        <SectionItem
          key={item.id}
          icon={item.isOverdue ? TriangleAlert : CalendarClock}
          tone={item.isOverdue ? "red" : "blue"}
          title={item.title}
          subtitle={item.subtitle}
          onClick={() => {
            onOpenPlan(item.id);
          }}
        />
      ))}
      <SectionItem icon={CalendarPlus} tone="green" title="Запланировать" onClick={onPlan} />
    </Section>
  );
}
