import { action } from "@reatom/core";

type InstallEntryDependencies = {
  telegram: { isInTelegram: boolean; openLink: (url: string) => void };
  // The install page of the same static site.
  installUrl: string;
};

// Telegram's in-app browser cannot install apps, so the entry hands over to the device's own.
export function reatomInstallEntry({ telegram, installUrl }: InstallEntryDependencies) {
  return {
    isShown: telegram.isInTelegram,
    open: action(() => {
      telegram.openLink(installUrl);
    }, "installEntry.open"),
  };
}

export type InstallEntryModel = ReturnType<typeof reatomInstallEntry>;
