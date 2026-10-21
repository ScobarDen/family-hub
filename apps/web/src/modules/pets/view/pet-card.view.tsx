import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

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
  photos: ReactNode;
};

// An archived Pet's card reads only: no editing, no planning, its history and the way back out.
export const PetCard = reatomComponent(
  ({ screen, model, expenses, journal, photos }: PetCardProps) => {
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
        {photos}
        {journal}
        <PetArchiveSection screen={screen} model={model} />
      </>
    );
  },
  "PetCard",
);
