import { action, atom, effect, noop, withConnectHook, wrap } from "@reatom/core";

import type {
  ColorScheme,
  SafeAreaInset,
  TelegramButton,
  TelegramWebApp,
  ThemeParams,
  Viewport,
} from "./telegram.types.ts";

type WebAppEvent = Parameters<TelegramWebApp["onEvent"]>[0];

export type Theme = { colorScheme: ColorScheme; params: ThemeParams };

const noInset: SafeAreaInset = { top: 0, bottom: 0, left: 0, right: 0 };
const writeAccessVersion = "6.9";
const shareMessageVersion = "8.0";
const backButtonVersion = "6.1";
const settingsButtonVersion = "7.0";

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

function reatomLayout(webApp: TelegramWebApp) {
  return {
    viewport: reatomWebAppState<Viewport>(webApp, {
      name: "telegram.viewport",
      event: "viewportChanged",
      read: () => ({
        height: webApp.viewportHeight,
        stableHeight: webApp.viewportStableHeight,
        isExpanded: webApp.isExpanded,
      }),
    }),
    safeArea: reatomWebAppState<SafeAreaInset>(webApp, {
      name: "telegram.safeArea",
      event: "safeAreaChanged",
      read: () => ({ ...noInset, ...webApp.safeAreaInset }),
    }),
    contentSafeArea: reatomWebAppState<SafeAreaInset>(webApp, {
      name: "telegram.contentSafeArea",
      event: "contentSafeAreaChanged",
      read: () => ({ ...noInset, ...webApp.contentSafeAreaInset }),
    }),
  };
}

function reatomPrompts(webApp: TelegramWebApp) {
  return {
    showAlert: action((message: string) => {
      webApp.showAlert(message);
    }, "telegram.showAlert"),
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
  const theme = reatomWebAppState<Theme>(webApp, {
    name: "telegram.theme",
    event: "themeChanged",
    read: () => ({ colorScheme: webApp.colorScheme, params: { ...webApp.themeParams } }),
  });

  return {
    initData: webApp.initData,
    // Display-only like the rest of initDataUnsafe: the server reads the signed initData.
    startParam: webApp.initDataUnsafe.start_param,
    canShareMessage: webApp.isVersionAtLeast(shareMessageVersion),
    platform: atom(webApp.platform, "telegram.platform"),
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
    theme,
    ...reatomLayout(webApp),
    launch: action(() => {
      webApp.ready();
      webApp.expand();
    }, "telegram.launch"),
    ...reatomPrompts(webApp),
    // Colours themselves arrive as --tg-theme-* variables; only Tailwind's dark: variant needs the class.
    followColorScheme: (element: HTMLElement) =>
      effect(() => {
        element.classList.toggle("dark", theme().colorScheme === "dark");
      }, "telegram.followColorScheme"),
    followPlatform: (element: HTMLElement) => {
      element.dataset.platform = lookOf(webApp.platform);
    },
  };
}

export type Telegram = ReturnType<typeof reatomTelegram>;
