import { PawPrint, Pencil } from "lucide-react";

import { Button, Section, SectionItem } from "@/common/ui";

import type { PetCard } from "../pets.lib.ts";

type PetHeaderProps = { card: PetCard; onEdit: () => void };

export function PetHeader({ card, onEdit }: PetHeaderProps) {
  return (
    <Section>
      <SectionItem
        icon={PawPrint}
        tone="orange"
        title={card.name}
        subtitle={card.subtitle}
        after={
          <Button size="icon-sm" variant="ghost" aria-label="Изменить" onClick={onEdit}>
            <Pencil />
          </Button>
        }
      />
      {card.facts.map((fact) => (
        <SectionItem key={fact.label} title={fact.value} subtitle={fact.label} />
      ))}
    </Section>
  );
}
