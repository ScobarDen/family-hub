import { action, noop } from "@reatom/core";

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

// The cache has a prefix of its own: «family-hub:» also holds the Device, which clear() must keep.
const storagePrefix = "family-hub:cache:";
const appPrefix = "family-hub:";
const layoutKey = "family-hub:storage-layout";
const layout = "2";
const keptAcrossLayouts = new Set(["family-hub:device", layoutKey]);
const darkScheme = "(prefers-color-scheme: dark)";
const telegramShare = "https://t.me/share/url";

export type BrowserWindow = Pick<
  Window,
  "alert" | "confirm" | "open" | "localStorage" | "addEventListener" | "removeEventListener"
> & {
  history: Pick<History, "pushState" | "back">;
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

function keysOf(storage: Storage): string[] {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? "");
}

// Before layout 2 the cache wrote straight under «family-hub:»; those copies go once.
function dropOldLayout(storage: Storage): void {
  if (storage.getItem(layoutKey) === layout) {
    return;
  }

  for (const key of keysOf(storage)) {
    if (
      key.startsWith(appPrefix) &&
      !key.startsWith(storagePrefix) &&
      !keptAcrossLayouts.has(key)
    ) {
      storage.removeItem(key);
    }
  }

  storage.setItem(layoutKey, layout);
}

function storageOver(storage: Storage): DeviceStorage {
  dropOldLayout(storage);

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
        for (const key of keysOf(storage).filter((name) => name.startsWith(storagePrefix))) {
          storage.removeItem(key);
        }

        return true;
      });
    },
  };
}

const edgeWidthPx = 24;
const swipeDistancePx = 70;
// A swipe counts as sideways while it climbs less than half its width.
const swipeSlope = 0.5;

// iOS gives an installed web app no back swipe, so a swipe from the left edge stands in for it.
function followEdgeSwipe(window: BrowserWindow, goBack: () => void): void {
  let start: Touch | undefined;

  window.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];

    start = touch !== undefined && touch.clientX < edgeWidthPx ? touch : undefined;
  });
  window.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];

    if (start !== undefined && touch !== undefined) {
      const across = touch.clientX - start.clientX;

      if (
        across > swipeDistancePx &&
        Math.abs(touch.clientY - start.clientY) < across * swipeSlope
      ) {
        goBack();
      }
    }

    start = undefined;
  });
}

type BackEntry = { isAsked: boolean; hasEntry: boolean; isDropping: boolean };

function keepEntry(window: BrowserWindow, entry: BackEntry): void {
  if (entry.isAsked && !entry.hasEntry) {
    window.history.pushState({ back: true }, "");
    entry.hasEntry = true;
  }
}

// Leaving the last screen that asked for Back takes its entry off, which must press nothing.
function dropEntry(window: BrowserWindow, entry: BackEntry): void {
  if (entry.hasEntry) {
    entry.hasEntry = false;
    entry.isDropping = true;
    window.history.back();
  }
}

// Telegram's Back becomes the system's: while a screen asks for it, a history entry waits for the
// back gesture, and its pop presses Back.
function reatomBrowserBack(window: BrowserWindow) {
  const handlers = new Set<() => void>();
  const entry: BackEntry = { isAsked: false, hasEntry: false, isDropping: false };
  const press = action(() => {
    for (const handler of handlers) {
      handler();
    }
  }, "browser.backButton.press");

  window.addEventListener("popstate", () => {
    if (entry.isDropping) {
      entry.isDropping = false;

      return;
    }

    entry.hasEntry = false;
    press();
    keepEntry(window, entry);
  });

  const button: TelegramButton = {
    show: () => {
      entry.isAsked = true;
      keepEntry(window, entry);
    },
    hide: () => {
      entry.isAsked = false;
      dropEntry(window, entry);
    },
    onClick: (handler) => handlers.add(handler),
    offClick: (handler) => handlers.delete(handler),
  };

  return { button, goBack: () => entry.hasEntry && window.history.back() };
}

function syncThemeColor(document: Document): void {
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue("--tg-theme-secondary-bg-color")
    .trim();

  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = color;
  }
}

// Outside Telegram the page colours itself from the Installed App's palette (see styles.css), and
// the system bar above it takes the page's own colour, which the screens start on.
export function followInstalledApp(document: Document): void {
  const root = document.documentElement;

  root.dataset.shell = "installed";
  new MutationObserver(() => {
    syncThemeColor(document);
  }).observe(root, { attributes: true, attributeFilter: ["class", "data-platform"] });
  syncThemeColor(document);
}

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
  const back = reatomBrowserBack(window);
  const isIos = /iPhone|iPad|Macintosh/u.test(window.navigator.userAgent);

  // Safari in a tab has its own back swipe; only the app on the home screen lacks one.
  if (isIos && window.matchMedia("(display-mode: standalone)").matches) {
    followEdgeSwipe(window, back.goBack);
  }

  const theme = themeOf(window);
  const openLink = openLinkOf(window);
  const startParameter = new URLSearchParams(window.location.search).get(deepLinkParameter);
  const webApp: TelegramWebApp = {
    ...telegramOnly,
    ...dialogsOf(window),
    initData: "",
    initDataUnsafe: { start_param: startParameter ?? undefined },
    platform: isIos ? "ios" : "android",
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

  return { webApp };
}
