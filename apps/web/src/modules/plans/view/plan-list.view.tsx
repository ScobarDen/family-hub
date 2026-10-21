import { Circle, Plus } from "lucide-react";

import { Section, SectionItem } from "@/common/ui";

import { DonePlans, type ListProps } from "./done-plans.view.tsx";

export function PlanList({ model, screen }: ListProps) {
  return (
    <>
      <Section>
        {screen.open.map((plan) => (
          <SectionItem
            key={plan.id}
            icon={Circle}
            tone="gray"
            title={plan.title}
            subtitle={plan.subtitle}
            onClick={() => {
              model.open(plan.id);
            }}
          />
        ))}
        <SectionItem icon={Plus} tone="green" title="Новый план" onClick={model.add} />
      </Section>
      {screen.done.length > 0 && <DonePlans model={model} screen={screen} />}
    </>
  );
}
