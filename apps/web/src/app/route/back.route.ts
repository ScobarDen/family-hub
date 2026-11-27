import { action } from "@reatom/core";

import type { SlotModule } from "@family-hub/contract";

import type { Slide } from "@/modules/changes";
import type { NestedBack } from "@/modules/form";

import { isTabRoot, type Screen } from "./screen.route.ts";
import type { Stack } from "./tab-stack.route.ts";

// Every slot module and the Profile have screens to step back from; the Feed has none.
export type NestedBacks = Record<SlotModule | "profile", NestedBack>;

function nestedOf(screen: Screen, nestedBack: NestedBacks | undefined): NestedBack | undefined {
  if (screen.kind === "module") {
    return screen.module === "feed" ? undefined : nestedBack?.[screen.module];
  }

  return screen.kind === "profile" ? nestedBack?.profile : undefined;
}

function nestedBackOf(screen: Screen, nestedBack: NestedBacks | undefined): NestedBack | undefined {
  const nested = nestedOf(screen, nestedBack);

  return nested?.canGoBack() === true ? nested : undefined;
}

export function reatomBack(
  {
    screen,
    nestedBack,
    slide,
  }: { screen: () => Screen; nestedBack: NestedBacks | undefined; slide: Slide },
  stack: Stack,
) {
  return action(() => {
    const nested = nestedBackOf(screen(), nestedBack);

    if (nested === undefined) {
      stack.pop();
    } else if (nested.closesInPlace()) {
      // The form slides down over a screen that stays put, as a swipe or «Отмена» closes it.
      nested.back();
    } else {
      slide("back", nested.back);
    }
  }, "navigation.back").extend(() => ({
    isVisible: () =>
      nestedBackOf(screen(), nestedBack) !== undefined ||
      stack.trail().length > 0 ||
      !isTabRoot(screen(), stack.activeTab()),
  }));
}
