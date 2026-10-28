import { action, atom, effect, noop, withConnectHook, wrap } from "@reatom/core";

import type {
  ColorScheme,
  HapticImpact,
  PopupParams,
  TelegramButton,
  TelegramWebApp,
} from "./telegram.types.ts";

type WebAppEvent = Parameters<TelegramWebApp["onEvent"]>[0];
const writeAccessVersion = "6.9";
const shareMessageVersion = "8.0";
const backButtonVersion = "6.1";
const settingsButtonVersion = "7.0";
const hapticsVersion = "6.1";
const verticalSwipesVersion = "7.7";
const deviceStorageVersion = "9.0";

type PlatformLook = "ios" | "android";

function reatomWebAppState<State>(
  webApp: TelegramWebApp,
  { name, event, read }: { name: string; event: WebAppEvent; read: () => State },
) {
  return atom(read(), name).extend(
    withConnectHook((target) => {
      const sync = wrap(() => {
        target.set(read());
      });

      webApp.onEvent(event, sync);

      return () => {
        webApp.offEvent(event, sync);
      };
    }),
  );
}

function reatomDialogs(webApp: TelegramWebApp) {
  return {
    showAlert: action((message: string) => {
      webApp.showAlert(message);
    }, "telegram.showAlert"),
    // Resolves with the pressed button's id, or undefined when the popup is dismissed.
    showPopup: action(
      async (params: PopupParams): Promise<string | undefined> =>
        wrap(
          new Promise<string | undefined>((resolve) => {
            webApp.showPopup(params, (buttonId) => {
              resolve(buttonId === null || buttonId === "" ? undefined : buttonId);
            });
          }),
        ),
      "telegram.showPopup",
    ),
  };
}

function reatomPrompts(webApp: TelegramWebApp) {
  return {
    requestWriteAccess: action(async (): Promise<boolean> => {
      if (!webApp.isVersionAtLeast(writeAccessVersion)) {
        return false;
      }

      return wrap(
        new Promise<boolean>((resolve) => {
          webApp.requestWriteAccess(resolve);
        }),
      );
    }, "telegram.requestWriteAccess"),
    shareMessage: action(
      async (preparedMessageId: string): Promise<boolean> =>
        wrap(
          new Promise<boolean>((resolve) => {
            webApp.shareMessage(preparedMessageId, resolve);
          }),
        ),
      "telegram.shareMessage",
    ),
    openTelegramLink: action((url: string) => {
      webApp.openTelegramLink(url);
    }, "telegram.openTelegramLink"),
  };
}

function reatomGestures(webApp: TelegramWebApp) {
  return {
    haptic: action((impact: HapticImpact) => {
      if (webApp.isVersionAtLeast(hapticsVersion)) {
        webApp.HapticFeedback.impactOccurred(impact);
      }
    }, "telegram.haptic"),
    // A swipe down closes the Mini App, which would fight a finger held on the microphone.
    disableVerticalSwipes: action(() => {
      if (webApp.isVersionAtLeast(verticalSwipesVersion)) {
        webApp.disableVerticalSwipes();
      }
    }, "telegram.disableVerticalSwipes"),
    enableVerticalSwipes: action(() => {
      if (webApp.isVersionAtLeast(verticalSwipesVersion)) {
        webApp.enableVerticalSwipes();
      }
    }, "telegram.enableVerticalSwipes"),
  };
}

function reatomInteractions(webApp: TelegramWebApp) {
  return { ...reatomDialogs(webApp), ...reatomPrompts(webApp), ...reatomGestures(webApp) };
}

function reatomButton(
  webApp: TelegramWebApp,
  { button, version, name }: { button: TelegramButton; version: string; name: string },
) {
  const isAvailable = webApp.isVersionAtLeast(version);

  return {
    isAvailable,
    follow(isVisible: () => boolean, onClick: () => void): () => void {
      if (!isAvailable) {
        return noop;
      }

      button.onClick(onClick);

      const visibility = effect(() => {
        if (isVisible()) {
          button.show();
        } else {
          button.hide();
        }
      }, name);

      return () => {
        visibility.unsubscribe();
        button.offClick(onClick);
        button.hide();
      };
    },
  };
}

function lookOf(platform: string): PlatformLook {
  return platform === "ios" || platform === "macos" ? "ios" : "android";
}

export function reatomTelegram(webApp: TelegramWebApp) {
  const colorScheme = reatomWebAppState<ColorScheme>(webApp, {
    name: "telegram.colorScheme",
    event: "themeChanged",
    read: () => webApp.colorScheme,
  });

  return {
    initData: webApp.initData,
    // Display-only like the rest of initDataUnsafe: the server reads the signed initData.
    startParam: webApp.initDataUnsafe.start_param,
    canShareMessage: webApp.isVersionAtLeast(shareMessageVersion),
    deviceStorage: webApp.isVersionAtLeast(deviceStorageVersion) ? webApp.DeviceStorage : undefined,
    backButton: reatomButton(webApp, {
      button: webApp.BackButton,
      version: backButtonVersion,
      name: "telegram.backButton",
    }),
    settingsButton: reatomButton(webApp, {
      button: webApp.SettingsButton,
      version: settingsButtonVersion,
      name: "telegram.settingsButton",
    }),
    launch: action(() => {
      webApp.ready();
      webApp.expand();
    }, "telegram.launch"),
    ...reatomInteractions(webApp),
    // Colours themselves arrive as --tg-theme-* variables; only Tailwind's dark: variant needs the class.
    followColorScheme: (element: HTMLElement) =>
      effect(() => {
        element.classList.toggle("dark", colorScheme() === "dark");
      }, "telegram.followColorScheme"),
    followPlatform: (element: HTMLElement) => {
      element.dataset.platform = lookOf(webApp.platform);
    },
  };
}

export type Telegram = ReturnType<typeof reatomTelegram>;
