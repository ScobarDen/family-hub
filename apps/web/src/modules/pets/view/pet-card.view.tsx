import { CalendarClock, Images, NotebookPen, PawPrint, Pencil, Wallet } from "lucide-react";

import { Button, Section, SectionItem } from "@/common/ui";

import type { PetCard as PetCardData } from "../pets.lib.ts";

type PetCardProps = {
  card: PetCardData;
  onEditProfile: () => void;
  onEditMemo: () => void;
};

const memoRows = [
  ["food", "Корм сейчас"],
  ["clinic", "Ветклиника"],
  ["important", "Важное"],
] as const;

export function PetCard({ card, onEditProfile, onEditMemo }: PetCardProps) {
  return (
    <>
      <Section>
        <SectionItem
          icon={PawPrint}
          tone="orange"
          title={card.name}
          subtitle={card.subtitle}
          after={
            <Button size="icon-sm" variant="ghost" aria-label="Изменить" onClick={onEditProfile}>
              <Pencil />
            </Button>
          }
        />
        {card.facts.map((fact) => (
          <SectionItem key={fact.label} title={fact.value} subtitle={fact.label} />
        ))}
      </Section>
      <Section title="Скоро">
        <SectionItem icon={CalendarClock} tone="red" title="Ближайших дел нет" />
      </Section>
      <Section title="Памятка" footer={card.memo.updated}>
        {memoRows.map(([key, label]) => (
          <SectionItem key={key} title={card.memo[key] ?? "—"} subtitle={label} />
        ))}
        <SectionItem icon={NotebookPen} tone="blue" title="Изменить памятку" onClick={onEditMemo} />
      </Section>
      <Section title="Траты за месяц">
        <SectionItem icon={Wallet} tone="green" title="Трат пока нет" />
      </Section>
      <Section title="Фото">
        <SectionItem icon={Images} tone="violet" title="Фото пока нет" />
      </Section>
      <Section title="Журнал">
        <SectionItem icon={NotebookPen} tone="gray" title="Записей пока нет" />
      </Section>
    </>
  );
}
