import { reatomComponent } from "@reatom/react";

import { FailureBar, LoadState, Revealed, SkeletonSection, SkeletonTiles } from "@/common/ui";

import type { TodayModel } from "../vm/today.vm.ts";
import { DueBlock } from "./due-block.view.tsx";
import { NextBlock } from "./next-block.view.tsx";
import { Tiles } from "./tiles.view.tsx";
import { UndoBar } from "./undo-bar.view.tsx";

export const Today = reatomComponent(({ model }: { model: TodayModel }) => {
  const failure = model.loadFailure();

  if (failure !== undefined) {
    return <LoadState failure={failure} onRetry={model.reload} />;
  }

  const isLoading = model.isLoading();

  return (
    <>
      <Revealed isSkeleton={isLoading} entrance="stagger">
        {isLoading ? (
          <>
            <SkeletonSection title="Сделать сегодня" rows={2} />
            <SkeletonSection title="Впереди" rows={3} />
            <SkeletonTiles count={5} />
          </>
        ) : (
          [
            <DueBlock key="due" model={model} />,
            <NextBlock key="next" model={model} />,
            <Tiles key="tiles" model={model} />,
          ]
        )}
      </Revealed>
      <UndoBar model={model} />
      <FailureBar failure={model.completionFailure()} onDismiss={model.dismissFailure} />
    </>
  );
}, "Today");
