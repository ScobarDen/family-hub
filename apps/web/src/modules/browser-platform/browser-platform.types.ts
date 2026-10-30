import type { PushSubscriptionChange } from "@family-hub/contract";

export type PushPermission = "default" | "granted" | "denied";

// iOS pushes only to an app added to the home screen.
export type PushAvailability = "available" | "needs-install" | "unsupported";

export type InstallChoice = "accepted" | "dismissed";

export type BrowserPlatform = {
  isIos: boolean;
  isAndroid: boolean;
  isStandalone: () => boolean;
  canPromptInstall: () => boolean;
  promptInstall: () => Promise<InstallChoice>;
  pushAvailability: () => PushAvailability;
  pushPermission: () => PushPermission;
  requestPushPermission: () => Promise<PushPermission>;
  subscribePush: (publicKey: string) => Promise<PushSubscriptionChange>;
  unsubscribePush: () => Promise<void>;
  pushSubscription: () => Promise<PushSubscriptionChange | undefined>;
  goTo: (url: string) => void;
  // The system share sheet with the file where the browser can, or the link, or the clipboard.
  shareFile: (url: string) => Promise<void>;
};

// The prompt Chromium offers once the page qualifies as installable; Safari has none.
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallChoice }>;
};
