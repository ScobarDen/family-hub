import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import {
  FailureBar,
  LoadState,
  Skeleton,
  SkeletonSection,
  SkeletonSectionLayout,
} from "@/common/ui";

import type { GoalsScreen, GoalsScreenModel } from "../vm/goals.vm.ts";
import { GoalDetails } from "./goal-details.view.tsx";
import { GoalForm, MovementForm } from "./goal-forms.view.tsx";
import { GoalList } from "./goal-list.view.tsx";

export type GoalsProps = { model: GoalsScreenModel };

const summary = (
  <div className="flex flex-col gap-0.5 px-5 pb-4">
    <span className="flex h-[1.5625rem] items-center">
      <Skeleton className="h-5 w-28" />
    </span>
    <span className="flex h-[calc(0.9375rem*1.5)] items-center">
      <Skeleton className="h-3.5 w-4/5" />
    </span>
  </div>
);

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

  if (screen.kind === "loading") {
    return (
      <SkeletonSectionLayout tabs={3} summary={summary}>
        <SkeletonSection rows={3} />
      </SkeletonSectionLayout>
    );
  }

  return <LoadState failure="Не получилось загрузить цели." onRetry={model.retry} />;
}

export const Goals = reatomComponent(
  ({ model }: GoalsProps) => (
    <>
      {contentOf(model, model.screen())}
      <FailureBar failure={model.failure()} onDismiss={model.dismissFailure} />
    </>
  ),
  "Goals",
);
