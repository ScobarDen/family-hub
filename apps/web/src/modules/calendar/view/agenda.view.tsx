import { Section, SectionItem } from "@/common/ui";

import type { CalendarItem } from "../calendar.lib.ts";
import { AgendaMark, isOverdue } from "./agenda-mark.view.tsx";

type AgendaProps = {
  title: string;
  items: CalendarItem[];
  isDated: boolean;
  empty: string;
  onOpen: (item: CalendarItem) => void;
};

const kinds = {
  event: "Событие",
  reminder: "Напоминание",
  birthday: "День рождения",
  due: "Уход за питомцем",
  plan: "Срок плана",
} as const;

function subtitleOf(item: CalendarItem, isDated: boolean): string {
  return [isOverdue(item) ? "Просрочено" : kinds[item.kind], isDated ? item.time : undefined]
    .filter((part) => part !== undefined)
    .join(" · ");
}

export function Agenda({ title, items, isDated, empty, onOpen }: AgendaProps) {
  return (
    <Section title={title}>
      {items.length === 0 && (
        <div className="px-5 py-3.5 text-[0.9375rem] text-muted-foreground">{empty}</div>
      )}
      {items.map((item, index) => (
        <SectionItem
          key={item.key}
          leading={
            <AgendaMark
              item={item}
              isDated={isDated}
              isSameDay={items[index - 1]?.date === item.date}
            />
          }
          title={item.title}
          subtitle={subtitleOf(item, isDated)}
          onClick={() => {
            onOpen(item);
          }}
        />
      ))}
    </Section>
  );
}
