import { action, atom, computed, wrap } from "@reatom/core";
import { z } from "zod";

import type { DeviceCache } from "@/common/device-cache";
import type { HomeScreen, HomeScreenStatus } from "@/common/telegram";

const offeredOnLaunch = 5;

type HomeScreenDependencies = {
  telegram: HomeScreen;
  deviceCache: Pick<DeviceCache, "withDeviceCache" | "whenRead">;
};

export type HomeScreenEntry = { isAdded: boolean };

export function reatomHomeScreen({ telegram, deviceCache }: HomeScreenDependencies) {
  const status = atom<HomeScreenStatus>("unsupported", "homeScreen.status");
  const launches = atom(0, "homeScreen.launches").extend(
    deviceCache.withDeviceCache({ key: "home-screen.launches", schema: z.number(), version: 1 }),
  );

  return {
    entry: computed(
      (): HomeScreenEntry | undefined =>
        status() === "unsupported" ? undefined : { isAdded: status() === "added" },
      "homeScreen.entry",
    ),

    add: action(() => {
      telegram.addToHomeScreen();
    }, "homeScreen.add"),
    countLaunch: action(async () => {
      await wrap(deviceCache.whenRead([launches]));
      launches.set(launches() + 1);
      status.set(await wrap(telegram.checkHomeScreenStatus()));

      if (launches() === offeredOnLaunch && status() === "missed") {
        telegram.addToHomeScreen();
      }
    }, "homeScreen.countLaunch"),
  };
}

export type HomeScreenModel = ReturnType<typeof reatomHomeScreen>;
