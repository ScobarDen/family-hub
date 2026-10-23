import { reatomComponent } from "@reatom/react";

import { LoadState } from "@/common/ui";

import type { TodayModel } from "../vm/today.vm.ts";
import { DueBlock } from "./due-block.view.tsx";
import { NextBlock } from "./next-block.view.tsx";
import { Tiles } from "./tiles.view.tsx";
import { UndoBar } from "./undo-bar.view.tsx";

export const Today = reatomComponent(({ model }: { model: TodayModel }) => {
  const failure = model.loadFailure();

  if (model.isLoading() || failure !== undefined) {
    return <LoadState {...(failure === undefined ? {} : { failure })} />;
  }

  return (
    <>
      <DueBlock model={model} />
      <NextBlock model={model} />
      <Tiles model={model} />
      <UndoBar model={model} />
    </>
  );
}, "Today");
