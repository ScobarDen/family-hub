import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import { Section, SectionItem } from "@/common/ui";

import type { GoalsScreen, GoalsScreenModel } from "../vm/goals.vm.ts";
import { GoalDetails } from "./goal-details.view.tsx";
import { GoalForm, MovementForm } from "./goal-forms.view.tsx";
import { GoalList } from "./goal-list.view.tsx";

export type GoalsProps = { model: GoalsScreenModel };

function contentOf(model: GoalsScreenModel, screen: GoalsScreen): ReactNode {
  if (screen.kind === "list") {
    return <GoalList model={model} screen={screen} />;
  }

  if (screen.kind === "goal") {
    return <GoalDetails goal={screen.goal} isCelebrating={screen.isCelebrating} model={model} />;
  }

  if (screen.kind === "goal-form") {
    return <GoalForm model={model.goalForm} onCancel={model.back} />;
  }

  if (screen.kind === "movement-form") {
    return <MovementForm model={model.movementForm} onCancel={model.back} />;
  }

  return (
    <Section>
      <SectionItem
        title={screen.kind === "loading" ? "Загружаем…" : "Не получилось загрузить цели."}
      />
    </Section>
  );
}

export const Goals = reatomComponent(
  ({ model }: GoalsProps) => contentOf(model, model.screen()),
  "Goals",
);
