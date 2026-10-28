import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import { FormDrawer, LoadState, Revealed, SkeletonSection } from "@/common/ui";

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

  if (screen.kind === "empty" || screen.kind === "list") {
    return <PetList model={model} screen={screen} />;
  }

  if (screen.kind === "loading") {
    return <SkeletonSection rows={2} />;
  }

  return <LoadState failure="Не получилось загрузить питомцев." onRetry={model.retry} />;
}

const PetForms = reatomComponent(({ model }: { model: PetsScreenModel }) => {
  const openForm = model.openForm();
  const titles = model.formTitles();

  return (
    <>
      <FormDrawer open={openForm === "profile"} title={titles.profile} onClose={model.back}>
        <PetProfileForm model={model.profileForm} onCancel={model.back} />
      </FormDrawer>
      <FormDrawer open={openForm === "memo"} title={titles.memo} onClose={model.back}>
        <PetMemoForm model={model.memoForm} onCancel={model.back} />
      </FormDrawer>
      <FormDrawer open={openForm === "delete"} title={titles.delete} onClose={model.back}>
        <PetDeleteForm model={model} />
      </FormDrawer>
    </>
  );
}, "PetForms");

export const Pets = reatomComponent((props: PetsProps) => {
  const screen = props.model.screen();

  return (
    <>
      <Revealed isSkeleton={screen.kind === "loading"}>{contentOf(props, screen)}</Revealed>
      <PetForms model={props.model} />
    </>
  );
}, "Pets");
