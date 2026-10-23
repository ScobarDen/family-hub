import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import { LoadState } from "@/common/ui";

import type { PetsScreen, PetsScreenModel } from "../vm/pets.vm.ts";
import { PetCard } from "./pet-card.view.tsx";
import { PetDeleteForm } from "./pet-delete-form.view.tsx";
import { PetList } from "./pet-list.view.tsx";
import { PetMemoForm } from "./pet-memo-form.view.tsx";
import { PetProfileForm } from "./pet-profile-form.view.tsx";

// The journal, its expenses and photos come from the care submodule through PetTab.
export type PetsProps = {
  model: PetsScreenModel;
  summary: ReactNode;
  onAddEntry: () => void;
  expenses: ReactNode;
  journal: ReactNode;
  photos: ReactNode;
};

function contentOf(props: PetsProps, screen: PetsScreen): ReactNode {
  const { model } = props;

  if (screen.kind === "card") {
    return <PetCard {...props} screen={screen} />;
  }

  if (screen.kind === "profile-form") {
    return <PetProfileForm model={model.profileForm} onCancel={model.back} />;
  }

  if (screen.kind === "memo-form") {
    return <PetMemoForm model={model.memoForm} onCancel={model.back} />;
  }

  if (screen.kind === "delete-form") {
    return <PetDeleteForm model={model} />;
  }

  if (screen.kind === "empty" || screen.kind === "list") {
    return <PetList model={model} screen={screen} />;
  }

  return (
    <LoadState
      failure={screen.kind === "failed" ? "Не получилось загрузить питомцев." : undefined}
    />
  );
}

export const Pets = reatomComponent(
  (props: PetsProps) => contentOf(props, props.model.screen()),
  "Pets",
);
