import { PawPrint, Plus } from "lucide-react";

import { Section, SectionItem } from "@/modules/ui";

import type { PetsScreen, PetsScreenModel } from "../vm/pets.vm.ts";
import { ArchivedPets } from "./archived-pets.view.tsx";

type PetListProps = {
  model: PetsScreenModel;
  screen: Extract<PetsScreen, { kind: "empty" | "list" }>;
};

export function PetList({ model, screen }: PetListProps) {
  return (
    <>
      <Section
        footer={
          screen.kind === "empty"
            ? "Карточка, памятка для тех, кто остаётся с питомцем, и вся его история."
            : undefined
        }
      >
        {screen.kind === "list" &&
          screen.pets.map((pet) => (
            <SectionItem
              key={pet.id}
              icon={PawPrint}
              title={pet.name}
              subtitle={pet.subtitle}
              onClick={() => {
                model.open(pet.id);
              }}
            />
          ))}
        <SectionItem icon={Plus} title="Добавить питомца" onClick={model.add} />
      </Section>
      {screen.archived.length > 0 && <ArchivedPets pets={screen.archived} onOpen={model.open} />}
    </>
  );
}
