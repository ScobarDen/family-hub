import { reatomComponent } from "@reatom/react";

import { Care, ExpensesBlock, JournalBlock, PhotosBlock } from "../care/index.ts";
import type { PetTabModel } from "../vm/pet-tab.vm.ts";
import { Pets } from "./pets.view.tsx";

export const PetTab = reatomComponent(({ model: { pets, care } }: { model: PetTabModel }) => {
  if (care.canGoBack()) {
    return <Care model={care} />;
  }

  return (
    <Pets
      model={pets}
      expenses={<ExpensesBlock model={care} />}
      journal={<JournalBlock model={care} />}
      photos={<PhotosBlock model={care} />}
    />
  );
}, "PetTab");
