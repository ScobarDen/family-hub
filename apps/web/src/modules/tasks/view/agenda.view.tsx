import { Section, SectionItem } from "@/common/ui";

import type { AgendaRow, CalendarItem } from "../calendar.lib.ts";

type AgendaProps = {
  title: string;
  rows: AgendaRow[];
  empty: string;
  onOpen: (item: CalendarItem) => void;
};

export function Agenda({ title, rows, empty, onOpen }: AgendaProps) {
  return (
    <Section title={title}>
      {rows.length === 0 && (
        <div className="px-5 py-3.5 text-[0.9375rem] text-muted-foreground">{empty}</div>
      )}
      {rows.map(({ item, subtitle, time }) => (
        <SectionItem
          key={item.key}
          leading={
            <span className="w-10 shrink-0 text-center text-[0.8125rem] font-medium">{time}</span>
          }
          title={item.title}
          subtitle={subtitle}
          onClick={() => {
            onOpen(item);
          }}
        />
      ))}
    </Section>
  );
}
