import { Section, SectionItem } from "@/common/ui";

import type { GoalDetails as Details } from "../goals.lib.ts";
import type { GoalsScreenModel } from "../vm/goals.vm.ts";
import { GoalActions, GoalClosing } from "./goal-actions.view.tsx";
import { GoalProgress } from "./goal-progress.view.tsx";
import { MovementRow } from "./movement-row.view.tsx";

type DetailsProps = { goal: Details; isCelebrating: boolean; model: GoalsScreenModel };

export function GoalDetails({ goal, isCelebrating, model }: DetailsProps) {
  return (
    <>
      {isCelebrating && (
        <p className="animate-bounce px-4 py-2 text-center text-2xl" role="status">
          Цель достигнута!
        </p>
      )}
      <Section>
        <GoalProgress goal={goal} />
      </Section>
      {!goal.isReadOnly && <GoalActions model={model} />}
      {goal.shares.length > 0 && (
        <Section title="По участникам">
          {goal.shares.map((share) => (
            <SectionItem key={share.id} title={share.name} subtitle={share.subtitle} />
          ))}
        </Section>
      )}
      <Section title="Движения">
        {goal.movements.length === 0 && <SectionItem title="Пока ничего не внесено" />}
        {goal.movements.map((movement) => (
          <MovementRow
            key={movement.id}
            movement={movement}
            model={model}
            isReadOnly={goal.isReadOnly}
          />
        ))}
      </Section>
      {!goal.isReadOnly && <GoalClosing model={model} />}
    </>
  );
}
