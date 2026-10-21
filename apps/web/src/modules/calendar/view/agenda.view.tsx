import { Bell, Cake, CalendarDays, Syringe, TriangleAlert } from "lucide-react";

import { formatDate } from "@/common/format-date";
import { Section, SectionItem } from "@/common/ui";

import type { CalendarItem } from "../calendar.lib.ts";

type AgendaProps = {
  title: string;
  items: CalendarItem[];
  isDated: boolean;
  empty: string;
  onOpen: (item: CalendarItem) => void;
};

const tones = { event: "red", reminder: "violet", birthday: "pink", due: "orange" } as const;

function iconOf(item: CalendarItem) {
  if (item.kind === "birthday") {
    return Cake;
  }

  if (item.kind === "reminder") {
    return Bell;
  }

  if (item.kind === "due") {
    return item.isOverdue ? TriangleAlert : Syringe;
  }

  return CalendarDays;
}

function subtitleOf(item: CalendarItem, isDated: boolean): string | undefined {
  const parts = [isDated ? formatDate(item.date) : undefined, item.time].filter(
    (part) => part !== undefined,
  );

  return parts.length === 0 ? undefined : parts.join(", ");
}

export function Agenda({ title, items, isDated, empty, onOpen }: AgendaProps) {
  return (
    <Section title={title}>
      {items.length === 0 && <SectionItem title={empty} />}
      {items.map((item) => (
        <SectionItem
          key={item.key}
          icon={iconOf(item)}
          tone={tones[item.kind]}
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
