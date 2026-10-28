import { reatomComponent } from "@reatom/react";

import { PrimaryButton, Section, SectionItem, SectionLayout } from "@/common/ui";

import type { GoalDetails as Details } from "../goals.lib.ts";
import type { GoalsScreenModel } from "../vm/goals.vm.ts";
import { GoalActions, GoalClosing } from "./goal-actions.view.tsx";
import { GoalProgress } from "./goal-progress.view.tsx";
import { MovementRow } from "./movement-row.view.tsx";

type DetailsProps = { goal: Details; isCelebrating: boolean; model: GoalsScreenModel };

function movementsOf({ goal, model }: DetailsProps) {
  return (
    <Section>
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
  );
}

function sharesOf({ goal }: DetailsProps) {
  return (
    <Section>
      {goal.shares.length === 0 && <SectionItem title="Пока никто не вносил" />}
      {goal.shares.map((share) => (
        <SectionItem key={share.id} title={share.name} subtitle={share.subtitle} />
      ))}
    </Section>
  );
}

export const GoalDetails = reatomComponent((props: DetailsProps) => {
  const { goal, isCelebrating, model } = props;

  return (
    <>
      <div role="status" className="contents">
        {isCelebrating && (
          <p className="animate-in px-4 py-2 text-center text-2xl leading-tight font-semibold tracking-tight duration-300 ease-out fade-in motion-safe:zoom-in-75">
            Цель достигнута!
          </p>
        )}
      </div>
      <SectionLayout
        summary={
          <Section>
            <GoalProgress goal={goal} />
          </Section>
        }
        action={
          goal.isReadOnly ? undefined : (
            <PrimaryButton
              onClick={() => {
                model.addMovement("contribution");
              }}
            >
              Внести взнос
            </PrimaryButton>
          )
        }
        tabs={[
          { key: "movements", title: "Взносы и снятия", content: movementsOf(props) },
          { key: "shares", title: "Участники", content: sharesOf(props) },
        ]}
      />
      {!goal.isReadOnly && <GoalActions model={model} />}
      {!goal.isReadOnly && <GoalClosing model={model} />}
    </>
  );
}, "GoalDetails");
