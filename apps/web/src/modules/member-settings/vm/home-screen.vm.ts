import { action, atom, computed, wrap } from "@reatom/core";

import type { HomeScreen, HomeScreenStatus } from "@/modules/telegram";

type HomeScreenDependencies = { telegram: HomeScreen };

export type HomeScreenEntry = { isAdded: boolean };

// Telegram's own shortcut, which opens the Mini App inside Telegram; offered only from the Profile.
export function reatomHomeScreen({ telegram }: HomeScreenDependencies) {
  const status = atom<HomeScreenStatus>("unsupported", "homeScreen.status");

  return {
    entry: computed(
      (): HomeScreenEntry | undefined =>
        status() === "unsupported" ? undefined : { isAdded: status() === "added" },
      "homeScreen.entry",
    ),

    add: action(() => {
      telegram.addToHomeScreen();
    }, "homeScreen.add"),
    load: action(async () => {
      status.set(await wrap(telegram.checkHomeScreenStatus()));
    }, "homeScreen.load"),
  };
}

export type HomeScreenModel = ReturnType<typeof reatomHomeScreen>;
