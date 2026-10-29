import { reatomComponent } from "@reatom/react";

import { Section } from "@/modules/ui";

import type { HomeScreenModel } from "../vm/home-screen.vm.ts";
import type { InstallEntryModel } from "../vm/install-entry.vm.ts";
import { HomeScreenSetting } from "./home-screen-setting.view.tsx";
import { InstallEntry } from "./install-entry.view.tsx";

export type AppSettingProps = { installEntry: InstallEntryModel; homeScreen: HomeScreenModel };

// The Installed App and the Telegram shortcut side by side; both exist only inside Telegram.
export const AppSetting = reatomComponent(({ installEntry, homeScreen }: AppSettingProps) => {
  if (!installEntry.isShown) {
    return null;
  }

  return (
    <Section title="Приложение">
      <InstallEntry model={installEntry} />
      <HomeScreenSetting model={homeScreen} />
    </Section>
  );
}, "AppSetting");
