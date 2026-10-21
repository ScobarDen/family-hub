import { Archive } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import type { PetListItem } from "../pets.lib.ts";

type ArchivedPetsProps = { pets: PetListItem[]; onOpen: (petId: string) => void };

export function ArchivedPets({ pets, onOpen }: ArchivedPetsProps) {
  return (
    <Section title="Архив">
      {pets.map((pet) => (
        <SectionItem
          key={pet.id}
          icon={Archive}
          tone="gray"
          title={pet.name}
          subtitle={pet.subtitle}
          onClick={() => {
            onOpen(pet.id);
          }}
        />
      ))}
    </Section>
  );
}
