import { reatomComponent } from "@reatom/react";
import { Images, NotebookPen, Wallet } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import type { PetCard as PetCardData } from "../pets.lib.ts";
import type { PetsScreenModel } from "../vm/pets.vm.ts";
import { PetHeader } from "./pet-header.view.tsx";
import { PetMemoSection } from "./pet-memo-section.view.tsx";
import { PetSoon } from "./pet-soon.view.tsx";

type PetCardProps = { card: PetCardData; model: PetsScreenModel };

export const PetCard = reatomComponent(
  ({ card, model }: PetCardProps) => (
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
      <Section title="Траты за месяц">
        <SectionItem icon={Wallet} tone="green" title="Трат пока нет" />
      </Section>
      <Section title="Фото" footer={model.photoHint()}>
        <SectionItem icon={Images} tone="violet" title="Фото пока нет" />
      </Section>
      <Section title="Журнал">
        <SectionItem icon={NotebookPen} tone="gray" title="Записей пока нет" />
      </Section>
    </>
  ),
  "PetCard",
);
