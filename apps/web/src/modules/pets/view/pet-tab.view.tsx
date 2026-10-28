import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import { FailureBar } from "@/common/ui";

import { Care, CareSummary, ExpensesBlock, JournalBlock, PhotosBlock } from "../care/index.ts";
import type { PetTabModel } from "../vm/pet-tab.vm.ts";
import { Pets } from "./pets.view.tsx";

function contentOf({ pets, care, nextVisit }: PetTabModel): ReactNode {
  if (care.screen().kind === "expenses") {
    return null;
  }

  return (
    <Pets
      model={pets}
      summary={<CareSummary model={care} nextVisit={nextVisit()} />}
      onAddEntry={() => {
        care.add("note");
      }}
      expenses={<ExpensesBlock model={care} />}
      journal={<JournalBlock model={care} />}
      photos={<PhotosBlock model={care} />}
    />
  );
}

export const PetTab = reatomComponent(
  ({ model }: { model: PetTabModel }) => (
    <>
      {contentOf(model)}
      <Care model={model.care} />
      <FailureBar failure={model.care.failure()} onDismiss={model.care.dismissFailure} />
    </>
  ),
  "PetTab",
);
