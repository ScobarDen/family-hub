import { Plus } from "lucide-react";

import { CheckButton, FieldError, Section, SectionItem } from "@/common/ui";

import { DonePlans, type ListProps } from "./done-plans.view.tsx";

export function PlanList({ model, screen }: ListProps) {
  return (
    <>
      <Section footer={<FieldError>{model.failure()}</FieldError>}>
        {screen.open.map((plan) => (
          <SectionItem
            key={plan.id}
            control={
              <CheckButton
                label={`Отметить выполненным: ${plan.title}`}
                isAlert={plan.isOverdue}
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
        <SectionItem icon={Plus} title="Новый план" onClick={model.add} />
      </Section>
      {screen.done.length > 0 && <DonePlans model={model} screen={screen} />}
    </>
  );
}
