import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import { PrimaryButton, SectionLayout } from "@/common/ui";

import type { PetsScreen, PetsScreenModel } from "../vm/pets.vm.ts";
import { PetArchiveSection } from "./pet-archive-section.view.tsx";
import { PetAvatar } from "./pet-avatar.view.tsx";
import { PetHeader } from "./pet-header.view.tsx";
import { PetMemoSection } from "./pet-memo-section.view.tsx";
import { PetSoon } from "./pet-soon.view.tsx";

type PetCardProps = {
  screen: Extract<PetsScreen, { kind: "card" }>;
  model: PetsScreenModel;
  summary: ReactNode;
  onAddEntry: () => void;
  expenses: ReactNode;
  journal: ReactNode;
  photos: ReactNode;
};

function tabsOf({ screen, model, expenses, journal, photos }: PetCardProps) {
  const { card } = screen;

  return [
    { key: "journal", title: "Журнал", content: journal },
    { key: "expenses", title: "Траты", content: expenses },
    { key: "album", title: "Альбом", content: photos },
    {
      key: "memo",
      title: "Памятка",
      content: (
        <PetMemoSection memo={card.memo} onEdit={card.isArchived ? undefined : model.editMemo} />
      ),
    },
  ];
}

// An archived Pet's card reads only: no editing, no planning, its history and the way back out.
export const PetCard = reatomComponent((props: PetCardProps) => {
  const { screen, model, summary, onAddEntry } = props;
  const { card } = screen;
  const isEditable = !card.isArchived;

  return (
    <>
      <PetHeader
        card={card}
        avatar={<PetAvatar card={card} model={model} />}
        onEdit={isEditable ? model.editProfile : undefined}
      />
      <SectionLayout
        summary={summary}
        lead={
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
        }
        action={
          isEditable ? (
            <PrimaryButton onClick={onAddEntry}>Добавить запись</PrimaryButton>
          ) : undefined
        }
        tabs={tabsOf(props)}
      />
      <PetArchiveSection screen={screen} model={model} />
    </>
  );
}, "PetCard");
