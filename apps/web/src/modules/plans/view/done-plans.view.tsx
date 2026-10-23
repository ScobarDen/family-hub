import { ChevronDown, ChevronUp } from "lucide-react";

import { CheckButton, Section, SectionItem } from "@/common/ui";

import type { PlansScreen, PlansScreenModel } from "../vm/plans.vm.ts";

export type ListProps = { model: PlansScreenModel; screen: Extract<PlansScreen, { kind: "list" }> };

export function DonePlans({ model, screen }: ListProps) {
  return (
    <Section>
      <SectionItem
        icon={screen.isDoneShown ? ChevronUp : ChevronDown}
        title={`Выполненные · ${screen.done.length}`}
        onClick={model.toggleDone}
      />
      {screen.isDoneShown &&
        screen.done.map((plan) => (
          <SectionItem
            key={plan.id}
            control={
              <CheckButton
                label={`Вернуть в работу: ${plan.title}`}
                isChecked
                disabled={model.isChanging()}
                onClick={() => {
                  model.togglePlanOf(plan.id);
                }}
              />
            }
            title={plan.title}
            subtitle={plan.subtitle}
            onClick={() => {
              model.open(plan.id);
            }}
          />
        ))}
    </Section>
  );
}
