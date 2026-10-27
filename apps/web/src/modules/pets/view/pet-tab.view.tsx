import { reatomComponent } from "@reatom/react";

import { Care, CareSummary, ExpensesBlock, JournalBlock, PhotosBlock } from "../care/index.ts";
import type { PetTabModel } from "../vm/pet-tab.vm.ts";
import { Pets } from "./pets.view.tsx";

export const PetTab = reatomComponent(({ model }: { model: PetTabModel }) => {
  const { pets, care } = model;

  if (care.canGoBack()) {
    return <Care model={care} />;
  }

  return (
    <Pets
      model={pets}
      summary={<CareSummary model={care} nextVisit={model.nextVisit()} />}
      onAddEntry={() => {
        care.add("note");
      }}
      expenses={<ExpensesBlock model={care} />}
      journal={<JournalBlock model={care} />}
      photos={<PhotosBlock model={care} />}
    />
  );
}, "PetTab");
