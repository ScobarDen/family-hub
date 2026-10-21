import { ChevronDown, ChevronUp, CircleCheck } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import type { PlansScreen, PlansScreenModel } from "../vm/plans.vm.ts";

export type ListProps = { model: PlansScreenModel; screen: Extract<PlansScreen, { kind: "list" }> };

export function DonePlans({ model, screen }: ListProps) {
  return (
    <Section>
      <SectionItem
        icon={screen.isDoneShown ? ChevronUp : ChevronDown}
        tone="gray"
        title={`Выполненные · ${screen.done.length}`}
        onClick={model.toggleDone}
      />
      {screen.isDoneShown &&
        screen.done.map((plan) => (
          <SectionItem
            key={plan.id}
            icon={CircleCheck}
            tone="green"
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
