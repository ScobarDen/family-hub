import { action, atom, withConnectHook, wrap } from "@reatom/core";

import type {
  ColorScheme,
  SafeAreaInset,
  TelegramWebApp,
  ThemeParams,
  Viewport,
} from "./telegram.types.ts";

type WebAppEvent = Parameters<TelegramWebApp["onEvent"]>[0];

export type Theme = { colorScheme: ColorScheme; params: ThemeParams };

const noInset: SafeAreaInset = { top: 0, bottom: 0, left: 0, right: 0 };

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

export function reatomTelegram(webApp: TelegramWebApp) {
  return {
    initData: webApp.initData,
    platform: webApp.platform,
    theme: reatomWebAppState<Theme>(webApp, {
      name: "telegram.theme",
      event: "themeChanged",
      read: () => ({ colorScheme: webApp.colorScheme, params: { ...webApp.themeParams } }),
    }),
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
    launch: action(() => {
      webApp.ready();
      webApp.expand();
    }, "telegram.launch"),
    showAlert(message: string) {
      webApp.showAlert(message);
    },
  };
}

export type Telegram = ReturnType<typeof reatomTelegram>;
