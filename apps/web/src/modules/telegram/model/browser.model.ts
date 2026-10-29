import { action, atom, noop } from "@reatom/core";

import { shareOrCopy } from "@/modules/browser-platform";

import type {
  BottomButton,
  ColorScheme,
  DeviceStorage,
  PopupParams,
  TelegramButton,
  TelegramWebApp,
} from "../telegram.types.ts";
import { browserStandInVersions } from "./telegram.model.ts";

// The URL parameter a Push or a link opens a record with, in place of `start_param`.
const deepLinkParameter = "open";

const storagePrefix = "family-hub:";
const darkScheme = "(prefers-color-scheme: dark)";
const telegramShare = "https://t.me/share/url";

export type BrowserWindow = Pick<
  Window,
  "alert" | "confirm" | "open" | "localStorage" | "addEventListener" | "removeEventListener"
> & {
  location: Pick<Location, "search">;
  matchMedia: (
    query: string,
  ) => Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;
  navigator: Pick<Navigator, "userAgent"> & {
    share?: (data: ShareData) => Promise<void>;
    clipboard?: Pick<Clipboard, "writeText">;
  };
};

const hiddenButton: BottomButton = {
  show: noop,
  hide: noop,
  onClick: noop,
  offClick: noop,
  setParams: noop,
  showProgress: noop,
  hideProgress: noop,
};

// Telegram's DeviceStorage answers later, never inside the call; so does this one.
function answerLater<Result>(
  callback: ((error: string | null, result?: Result) => void) | undefined,
  read: () => Result,
): void {
  queueMicrotask(() => {
    try {
      callback?.(null, read());
    } catch (error) {
      callback?.(String(error));
    }
  });
}

function storageOver(storage: Storage): DeviceStorage {
  return {
    setItem: (key, value, callback) => {
      answerLater(callback, () => {
        storage.setItem(storagePrefix + key, value);

        return true;
      });
    },
    getItem: (key, callback) => {
      answerLater(callback, () => storage.getItem(storagePrefix + key));
    },
    removeItem: (key, callback) => {
      answerLater(callback, () => {
        storage.removeItem(storagePrefix + key);

        return true;
      });
    },
    clear: (callback) => {
      answerLater(callback, () => {
        for (const key of Object.keys(storage).filter((name) => name.startsWith(storagePrefix))) {
          storage.removeItem(key);
        }

        return true;
      });
    },
  };
}

// The app's own «назад» in place of Telegram's: shown and pressed through the same interface.
function reatomBrowserBack() {
  const isVisible = atom(false, "browser.backButton.isVisible");
  const handlers = new Set<() => void>();
  const button: TelegramButton = {
    show: () => {
      isVisible.set(true);
    },
    hide: () => {
      isVisible.set(false);
    },
    onClick: (handler) => {
      handlers.add(handler);
    },
    offClick: (handler) => {
      handlers.delete(handler);
    },
  };

  return {
    button,
    isVisible,
    press: action(() => {
      for (const handler of handlers) {
        handler();
      }
    }, "browser.backButton.press"),
  };
}

export type BrowserBack = Pick<ReturnType<typeof reatomBrowserBack>, "isVisible" | "press">;

function openLinkOf(window: BrowserWindow) {
  return (link: string) => {
    const target = new URL(link);

    if (`${target.origin}${target.pathname}` !== telegramShare) {
      window.open(link, "_blank", "noopener");

      return;
    }

    const text = target.searchParams.get("text") ?? "";
    const url = target.searchParams.get("url") ?? "";

    shareOrCopy(window, { data: { text, url }, link: `${text} ${url}`.trim() }).catch(noop);
  };
}

// A popup with a choice becomes confirm(), one without becomes alert().
function popupOf(window: BrowserWindow) {
  return (params: PopupParams, callback?: (buttonId: string | null) => void) => {
    const choices = params.buttons.filter(({ type }) => type !== "cancel" && type !== "close");
    const text = [params.title, params.message].filter(Boolean).join("\n\n");
    const first = choices[0]?.id ?? null;

    if (choices.length === params.buttons.length) {
      window.alert(text);
      callback?.(first);

      return;
    }

    callback?.(window.confirm(text) ? first : null);
  };
}

function confirmLeaving(event: Event): void {
  event.preventDefault();
}

function dialogsOf(window: BrowserWindow) {
  return {
    showAlert: (message: string, callback?: () => void) => {
      window.alert(message);
      callback?.();
    },
    showPopup: popupOf(window),
    enableClosingConfirmation: () => {
      window.addEventListener("beforeunload", confirmLeaving);
    },
    disableClosingConfirmation: () => {
      window.removeEventListener("beforeunload", confirmLeaving);
    },
  };
}

function themeOf(window: BrowserWindow) {
  const media = window.matchMedia(darkScheme);

  return {
    get colorScheme(): ColorScheme {
      return media.matches ? "dark" : "light";
    },
    onEvent: (_event: string, handler: () => void) => {
      media.addEventListener("change", handler);
    },
    offEvent: (_event: string, handler: () => void) => {
      media.removeEventListener("change", handler);
    },
  };
}

// What has no meaning outside Telegram answers like an old client: unsupported, refused, hidden.
const telegramOnly = {
  ready: noop,
  expand: noop,
  requestWriteAccess: (callback?: (isAllowed: boolean) => void) => callback?.(false),
  shareMessage: (_id: string, callback?: (isSent: boolean) => void) => callback?.(false),
  addToHomeScreen: noop,
  checkHomeScreenStatus: (callback?: (status: "unsupported") => void) => callback?.("unsupported"),
  requestFullscreen: noop,
  exitFullscreen: noop,
  HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
  enableVerticalSwipes: noop,
  disableVerticalSwipes: noop,
  MainButton: hiddenButton,
  SecondaryButton: hiddenButton,
  SettingsButton: hiddenButton,
};

// The Installed App runs the Mini App's code outside Telegram: the browser serves the same
// interface, and what has no meaning here reports an old version and stays hidden.
export function reatomBrowserWebApp(window: BrowserWindow) {
  const back = reatomBrowserBack();
  const theme = themeOf(window);
  const openLink = openLinkOf(window);
  const startParameter = new URLSearchParams(window.location.search).get(deepLinkParameter);
  const webApp: TelegramWebApp = {
    ...telegramOnly,
    ...dialogsOf(window),
    initData: "",
    initDataUnsafe: { start_param: startParameter ?? undefined },
    platform: /iPhone|iPad|Macintosh/u.test(window.navigator.userAgent) ? "ios" : "android",
    get colorScheme() {
      return theme.colorScheme;
    },
    isVersionAtLeast: (version) => browserStandInVersions.has(version),
    openTelegramLink: openLink,
    openLink,
    DeviceStorage: storageOver(window.localStorage),
    BackButton: back.button,
    onEvent: theme.onEvent,
    offEvent: theme.offEvent,
  };

  return { webApp, back: { isVisible: back.isVisible, press: back.press } };
}
