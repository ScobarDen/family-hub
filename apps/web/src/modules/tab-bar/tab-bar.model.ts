import { action, atom, computed, withAsync, wrap } from "@reatom/core";

import { defaultTabBar, type SlotModule } from "@family-hub/contract";

import type { TabBarApi } from "./tab-bar.api.ts";

type TabBarModulesDependencies = {
  api: TabBarApi;
  saved: () => SlotModule[] | undefined;
};

export function reatomTabBarModules({ api, saved }: TabBarModulesDependencies) {
  const confirmed = atom<SlotModule[] | undefined>(undefined, "tabBar.confirmed");
  const draft = atom<SlotModule[] | undefined>(undefined, "tabBar.draft");
  const failure = atom<string | undefined>(undefined, "tabBar.failure");
  const modules = computed(
    () => draft() ?? confirmed() ?? saved() ?? defaultTabBar,
    "tabBar.modules",
  );

  const save = action(async (next: SlotModule[]) => {
    failure.set(undefined);
    draft.set(next);

    try {
      confirmed.set(await wrap(api.save(next)));
    } catch {
      failure.set("Не получилось сохранить разделы на панели. Попробуйте ещё раз.");
    } finally {
      // A later change still in flight keeps its own draft.
      if (draft() === next) {
        draft.set(undefined);
      }
    }
  }, "tabBar.save").extend(withAsync());

  return { modules, failure, save };
}

export type TabBarModules = ReturnType<typeof reatomTabBarModules>;
