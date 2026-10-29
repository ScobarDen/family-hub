import { atom } from "@reatom/core";

import type { PushSubscriptionChange } from "@family-hub/contract";

import type {
  BrowserPlatform,
  InstallChoice,
  PushAvailability,
  PushPermission,
} from "./browser-platform.types.ts";

export const fakePushSubscription: PushSubscriptionChange = {
  endpoint: "https://push.example.net/phone",
  keys: { p256dh: "BCVxsr7N", auth: "BTBZMqHH" },
};

type FakeBrowserPlatformOptions = {
  isIos?: boolean;
  isStandalone?: boolean;
  pushAvailability?: PushAvailability;
  permission?: PushPermission;
  // What the Member answers when the browser asks.
  answer?: PushPermission;
  installChoice?: InstallChoice;
};

function fakePush({
  pushAvailability = "available",
  permission = "default",
  answer = "granted",
}: FakeBrowserPlatformOptions) {
  const currentPermission = atom(permission, "fakeBrowser.permission");
  const subscription = atom<PushSubscriptionChange | undefined>(undefined, "fakeBrowser.push");

  return {
    subscription,
    platform: {
      pushAvailability: () => pushAvailability,
      pushPermission: () => currentPermission(),
      requestPushPermission: async () => {
        currentPermission.set(answer);

        return answer;
      },
      subscribePush: async () => {
        subscription.set(fakePushSubscription);

        return fakePushSubscription;
      },
      unsubscribePush: async () => {
        subscription.set(undefined);
      },
      hasPushSubscription: async () => subscription() !== undefined,
    },
  };
}

export function fakeBrowserPlatform(options: FakeBrowserPlatformOptions = {}) {
  const { isIos = false, isStandalone = false, installChoice = "accepted" } = options;
  const installPrompt = atom(false, "fakeBrowser.installPrompt");
  const push = fakePush(options);
  const visited: string[] = [];
  const shared: string[] = [];

  const platform: BrowserPlatform = {
    ...push.platform,
    isIos,
    isStandalone: () => isStandalone,
    canPromptInstall: () => installPrompt(),
    promptInstall: async () => {
      installPrompt.set(false);

      return installChoice;
    },
    goTo: (url) => {
      visited.push(url);
    },
    shareFile: async (url) => {
      shared.push(url);
    },
  };

  return {
    platform,
    visited,
    shared,
    offerInstall: () => {
      installPrompt.set(true);
    },
    isSubscribed: () => push.subscription() !== undefined,
    subscribe: () => {
      push.subscription.set(fakePushSubscription);
    },
  };
}

export type FakeBrowserPlatform = ReturnType<typeof fakeBrowserPlatform>;
