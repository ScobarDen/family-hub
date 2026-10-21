import { reatomComponent } from "@reatom/react";
import { Images } from "lucide-react";
import type { ReactNode } from "react";

import { Section, SectionItem } from "@/common/ui";

import type { PetsScreen, PetsScreenModel } from "../vm/pets.vm.ts";
import { PetArchiveSection } from "./pet-archive-section.view.tsx";
import { PetHeader } from "./pet-header.view.tsx";
import { PetMemoSection } from "./pet-memo-section.view.tsx";
import { PetSoon } from "./pet-soon.view.tsx";

type PetCardProps = {
  screen: Extract<PetsScreen, { kind: "card" }>;
  model: PetsScreenModel;
  expenses: ReactNode;
  journal: ReactNode;
};

// An archived Pet's card reads only: no editing, no planning, its history and the way back out.
export const PetCard = reatomComponent(({ screen, model, expenses, journal }: PetCardProps) => {
  const { card } = screen;
  const isEditable = !card.isArchived;

  return (
    <>
      <PetHeader card={card} onEdit={isEditable ? model.editProfile : undefined} />
      <PetSoon
        soon={card.soon}
        onOpen={model.openSoon}
        onPlan={
          isEditable
            ? () => {
                model.plan(card.id);
              }
            : undefined
        }
      />
      <PetMemoSection memo={card.memo} onEdit={isEditable ? model.editMemo : undefined} />
      {expenses}
      <Section title="Фото" footer={model.photoHint()}>
        <SectionItem icon={Images} tone="violet" title="Фото пока нет" />
      </Section>
      {journal}
      <PetArchiveSection screen={screen} model={model} />
    </>
  );
}, "PetCard");
