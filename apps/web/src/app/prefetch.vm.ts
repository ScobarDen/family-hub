import { action, take, throwAbort, wrap } from "@reatom/core";

import type { SlotModule } from "@family-hub/contract";

type PrefetchDependencies = {
  isSignedIn: () => boolean;
  slots: () => SlotModule[];
  today: () => unknown;
  screens: Record<SlotModule, () => unknown>;
};

// Reading a screen starts its load. The slots are known only once sign-in returns the settings;
// a deep link's target is already loading on screen, so it goes out together with Today.
export function reatomPrefetch({ isSignedIn, slots, today, screens }: PrefetchDependencies) {
  return action(async () => {
    if (!isSignedIn()) {
      await wrap(take(isSignedIn, (is) => is || throwAbort()));
    }

    today();

    for (const module of slots()) {
      screens[module]();
    }
  }, "prefetch");
}
