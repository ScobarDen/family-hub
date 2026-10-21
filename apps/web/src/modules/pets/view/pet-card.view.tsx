import { reatomComponent } from "@reatom/react";
import { Images } from "lucide-react";
import type { ReactNode } from "react";

import { Section, SectionItem } from "@/common/ui";

import type { PetCard as PetCardData } from "../pets.lib.ts";
import type { PetsScreenModel } from "../vm/pets.vm.ts";
import { PetHeader } from "./pet-header.view.tsx";
import { PetMemoSection } from "./pet-memo-section.view.tsx";
import { PetSoon } from "./pet-soon.view.tsx";

type PetCardProps = {
  card: PetCardData;
  model: PetsScreenModel;
  expenses: ReactNode;
  journal: ReactNode;
};

export const PetCard = reatomComponent(
  ({ card, model, expenses, journal }: PetCardProps) => (
    <>
      <PetHeader card={card} onEdit={model.editProfile} />
      <PetSoon
        soon={card.soon}
        onOpenPlan={model.openPlan}
        onPlan={() => {
          model.plan(card.id);
        }}
      />
      <PetMemoSection memo={card.memo} onEdit={model.editMemo} />
      {expenses}
      <Section title="Фото" footer={model.photoHint()}>
        <SectionItem icon={Images} tone="violet" title="Фото пока нет" />
      </Section>
      {journal}
    </>
  ),
  "PetCard",
);
