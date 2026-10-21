import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import { Section, SectionItem } from "@/common/ui";

import type { PlansScreen, PlansScreenModel } from "../vm/plans.vm.ts";
import { PlanDetails } from "./plan-details.view.tsx";
import { PlanForm, SubplanForm } from "./plan-forms.view.tsx";
import { PlanList } from "./plan-list.view.tsx";

export type PlansProps = { model: PlansScreenModel };

function contentOf(model: PlansScreenModel, screen: PlansScreen): ReactNode {
  if (screen.kind === "list") {
    return <PlanList model={model} screen={screen} />;
  }

  if (screen.kind === "plan") {
    return <PlanDetails plan={screen.plan} model={model} />;
  }

  if (screen.kind === "plan-form") {
    return <PlanForm model={model.planForm} onCancel={model.back} />;
  }

  if (screen.kind === "subplan-form") {
    return <SubplanForm model={model.subplanForm} onCancel={model.back} />;
  }

  return (
    <Section>
      <SectionItem
        title={screen.kind === "loading" ? "Загружаем…" : "Не получилось загрузить планы."}
      />
    </Section>
  );
}

export const Plans = reatomComponent(
  ({ model }: PlansProps) => contentOf(model, model.screen()),
  "Plans",
);
