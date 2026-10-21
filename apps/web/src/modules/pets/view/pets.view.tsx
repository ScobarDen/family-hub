import { reatomComponent } from "@reatom/react";
import { PawPrint, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Section, SectionItem } from "@/common/ui";

import type { PetsScreen, PetsScreenModel } from "../vm/pets.vm.ts";
import { PetCard } from "./pet-card.view.tsx";
import { PetMemoForm } from "./pet-memo-form.view.tsx";
import { PetProfileForm } from "./pet-profile-form.view.tsx";

// The journal, its expenses and weight belong to the care module; the page passes them in.
export type PetsProps = { model: PetsScreenModel; expenses: ReactNode; journal: ReactNode };

type ListScreen = Extract<PetsScreen, { kind: "loading" | "failed" | "empty" | "list" }>;

const notices: Partial<Record<ListScreen["kind"], string>> = {
  loading: "Загружаем…",
  failed: "Не получилось загрузить питомцев.",
};

function PetList({ model, screen }: { model: PetsScreenModel; screen: ListScreen }) {
  const notice = notices[screen.kind];

  if (notice !== undefined) {
    return (
      <Section>
        <SectionItem title={notice} />
      </Section>
    );
  }

  return (
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
            tone="orange"
            title={pet.name}
            subtitle={pet.subtitle}
            onClick={() => {
              model.open(pet.id);
            }}
          />
        ))}
      <SectionItem icon={Plus} tone="green" title="Добавить питомца" onClick={model.add} />
    </Section>
  );
}

function contentOf({ model, expenses, journal }: PetsProps, screen: PetsScreen): ReactNode {
  if (screen.kind === "card") {
    return <PetCard card={screen.card} model={model} expenses={expenses} journal={journal} />;
  }

  if (screen.kind === "profile-form") {
    return <PetProfileForm model={model.profileForm} onCancel={model.back} />;
  }

  if (screen.kind === "memo-form") {
    return <PetMemoForm model={model.memoForm} onCancel={model.back} />;
  }

  return <PetList model={model} screen={screen} />;
}

export const Pets = reatomComponent(
  (props: PetsProps) => contentOf(props, props.model.screen()),
  "Pets",
);
