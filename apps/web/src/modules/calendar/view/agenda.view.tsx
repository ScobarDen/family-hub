import { Bell, Cake, CalendarDays, ListTodo, Syringe, TriangleAlert } from "lucide-react";

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

const tones = {
  event: "red",
  reminder: "violet",
  birthday: "pink",
  due: "orange",
  plan: "blue",
} as const;

function toneOf(item: CalendarItem) {
  return item.kind === "plan" && item.isOverdue ? "red" : tones[item.kind];
}

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

  if (item.kind === "plan") {
    return item.isOverdue ? TriangleAlert : ListTodo;
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
          tone={toneOf(item)}
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
