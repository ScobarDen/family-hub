import { action, atom, computed, withAsync, wrap } from "@reatom/core";

import type { BrowserPlatform } from "@/modules/browser-platform";
import { detached } from "@/modules/changes";

export type InstallScreen =
  | { kind: "opening" }
  | { kind: "prompt" }
  | { kind: "ios-steps" }
  | { kind: "unsupported" }
  | { kind: "installed" };

type InstallPageDependencies = {
  platform: BrowserPlatform;
  // Where the Installed App starts.
  appUrl: string;
};

// The page the Mini App's «Установить как приложение» opens in the device's own browser.
export function reatomInstallPage({ platform, appUrl }: InstallPageDependencies) {
  const isInstalled = atom(false, "installPage.isInstalled");
  const install = action(async () => {
    if ((await wrap(platform.promptInstall())) === "accepted") {
      isInstalled.set(true);
    }
  }, "installPage.prompt").extend(withAsync());

  return {
    screen: computed((): InstallScreen => {
      if (platform.isStandalone()) {
        return { kind: "opening" };
      }

      if (isInstalled()) {
        return { kind: "installed" };
      }

      if (platform.canPromptInstall()) {
        return { kind: "prompt" };
      }

      return { kind: platform.isIos ? "ios-steps" : "unsupported" };
    }, "installPage.screen"),

    // Opened from an app that is already installed, the page goes straight into it.
    start: action(() => {
      if (platform.isStandalone()) {
        platform.goTo(appUrl);
      }
    }, "installPage.start"),
    install: detached(install, "installPage.install"),
    openApp: action(() => {
      platform.goTo(appUrl);
    }, "installPage.openApp"),
  };
}

export type InstallPageModel = ReturnType<typeof reatomInstallPage>;
