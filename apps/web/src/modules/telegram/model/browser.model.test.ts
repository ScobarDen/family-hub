import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { reatomBrowserWebApp, type BrowserWindow } from "./browser.model.ts";
import { reatomTelegram } from "./telegram.model.ts";

type Listener = () => void;

// Like the real localStorage, every kept key is also an own enumerable property.
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return items.size;
    },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
    clear: () => {
      items.clear();
    },
  };

  return new Proxy(storage, {
    ownKeys: () => [...items.keys()],
    getOwnPropertyDescriptor: (_target, key) =>
      typeof key === "string" && items.has(key)
        ? { value: items.get(key), enumerable: true, configurable: true, writable: true }
        : undefined,
  });
}

function fakeBrowser({
  search = "",
  isDark = false,
  canShare = true,
  localStorage = memoryStorage(),
}: { search?: string; isDark?: boolean; canShare?: boolean; localStorage?: Storage } = {}) {
  const media = { matches: isDark, listeners: new Set<Listener>() };
  const opened: string[] = [];
  const shared: ShareData[] = [];
  const copied: string[] = [];
  const alerts: string[] = [];
  const popListeners = new Set<Listener>();
  const history = { entries: 0 };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Node has no window to build one from
  const window: BrowserWindow = {
    location: { search },
    matchMedia: () => ({
      get matches() {
        return media.matches;
      },
      addEventListener: (_type: string, listener: Listener) => {
        media.listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: Listener) => {
        media.listeners.delete(listener);
      },
    }),
    navigator: {
      userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130.0",
      share: canShare
        ? async (data: ShareData) => {
            shared.push(data);
          }
        : undefined,
      clipboard: {
        writeText: async (text: string) => {
          copied.push(text);
        },
      },
    },
    alert: (message?: string) => {
      alerts.push(message ?? "");
    },
    confirm: () => true,
    open: (url?: string | URL) => {
      opened.push(String(url));

      return null;
    },
    localStorage,
    history: {
      pushState: () => {
        history.entries += 1;
      },
      back: () => {
        history.entries -= 1;
        queueMicrotask(() => {
          for (const listener of popListeners) {
            listener();
          }
        });
      },
    },
    addEventListener: (type: string, listener: Listener) => {
      if (type === "popstate") {
        popListeners.add(listener);
      }
    },
    removeEventListener: noop,
  } as unknown as BrowserWindow;

  return {
    window,
    opened,
    shared,
    copied,
    alerts,
    history,
    // What the system's back gesture does.
    async goBack() {
      window.history.back();
      await Promise.resolve();
    },
    turnDark() {
      media.matches = true;

      for (const listener of media.listeners) {
        listener();
      }
    },
  };
}

function telegramIn(browser: ReturnType<typeof fakeBrowser>) {
  const { webApp } = reatomBrowserWebApp(browser.window);

  return { telegram: reatomTelegram(webApp) };
}

const inviteShare =
  "https://t.me/share/url?url=https%3A%2F%2Ft.me%2Fbot%3Fstartapp%3Dinv_abc&text=%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82";

beforeEach(() => {
  context.reset();
});

describe("the Installed App's stand-in for Telegram", () => {
  test("is not Telegram and has nothing to sign", () => {
    const { telegram } = telegramIn(fakeBrowser());

    expect([telegram.isInTelegram, telegram.initData]).toEqual([false, ""]);
  });

  test("follows the system's light or dark theme", async () => {
    const browser = fakeBrowser();
    const { telegram } = telegramIn(browser);
    const classes = new Set<string>();
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the class list is all the theme touches
    const element = {
      classList: {
        toggle: (name: string, isOn: boolean) => {
          if (isOn) {
            classes.add(name);
          } else {
            classes.delete(name);
          }
        },
      },
    } as unknown as HTMLElement;
    const following = telegram.followColorScheme(element);

    await vi.waitFor(() => {
      expect(classes.has("dark")).toBe(false);
    });
    await Promise.resolve();
    browser.turnDark();

    await vi.waitFor(() => {
      expect(classes.has("dark")).toBe(true);
    });
    following.unsubscribe();
  });

  test("reads a deep link from the URL in place of start_param", () => {
    const { telegram } = telegramIn(fakeBrowser({ search: "?open=task_0192f0a0" }));

    expect(telegram.startParam).toBe("task_0192f0a0");
  });

  test("hands Back to the system's back gesture while a screen asks for it", async () => {
    const browser = fakeBrowser();
    const { telegram } = telegramIn(browser);
    const pressed = vi.fn<() => void>();
    const stop = telegram.backButton.follow(() => true, pressed);

    await browser.goBack();

    expect(pressed).toHaveBeenCalledOnce();
    expect(browser.history.entries).toBe(1);
    stop();
  });

  test("gives the back gesture back to the system once no screen asks for Back", async () => {
    const browser = fakeBrowser();
    const { telegram } = telegramIn(browser);
    const pressed = vi.fn<() => void>();
    const stop = telegram.backButton.follow(() => true, pressed);

    stop();
    await Promise.resolve();

    expect(browser.history.entries).toBe(0);
    expect(pressed).not.toHaveBeenCalled();
  });

  test("hides what only makes sense in Telegram", async () => {
    const { telegram } = telegramIn(fakeBrowser());

    expect(await telegram.checkHomeScreenStatus()).toBe("unsupported");
    expect(await telegram.requestWriteAccess()).toBe(false);
    expect([
      telegram.canShareMessage,
      telegram.settingsButton.isAvailable,
      telegram.mainButton.isAvailable,
    ]).toEqual([false, false, false]);
  });

  test("shares an Invite through the system share sheet", async () => {
    const browser = fakeBrowser();
    const { telegram } = telegramIn(browser);

    telegram.openTelegramLink(inviteShare);

    await vi.waitFor(() => {
      expect(browser.shared).toEqual([
        { text: "Привет", url: "https://t.me/bot?startapp=inv_abc" },
      ]);
    });
    expect(browser.opened).toEqual([]);
  });

  test("copies the link where there is no share sheet", async () => {
    const browser = fakeBrowser({ canShare: false });
    const { telegram } = telegramIn(browser);

    telegram.openTelegramLink(inviteShare);

    await vi.waitFor(() => {
      expect(browser.alerts).toEqual(["Ссылка скопирована"]);
    });
    expect(browser.copied).toEqual(["Привет https://t.me/bot?startapp=inv_abc"]);
  });

  test("clears only the cache's own keys, so the Device kept by Telegram Login survives", async () => {
    const localStorage = memoryStorage();
    const { webApp } = reatomBrowserWebApp(fakeBrowser({ localStorage }).window);

    localStorage.setItem("family-hub:device", "device-1");
    await new Promise((resolve) => {
      webApp.DeviceStorage.setItem("today", "{}", resolve);
    });
    await new Promise((resolve) => {
      webApp.DeviceStorage.clear(resolve);
    });

    expect(localStorage.getItem("family-hub:device")).toBe("device-1");
    expect(localStorage.getItem("family-hub:cache:today")).toBeNull();
  });

  test("drops the cache copies kept before the cache had its own prefix, once, and keeps the Device", () => {
    const localStorage = memoryStorage();

    localStorage.setItem("family-hub:today", "{}");
    localStorage.setItem("family-hub:device-cache.owner", "member-1");
    localStorage.setItem("family-hub:device", "device-1");
    reatomBrowserWebApp(fakeBrowser({ localStorage }).window);
    localStorage.setItem("family-hub:later", "kept");
    reatomBrowserWebApp(fakeBrowser({ localStorage }).window);

    expect(localStorage.getItem("family-hub:today")).toBeNull();
    expect(localStorage.getItem("family-hub:device-cache.owner")).toBeNull();
    expect(localStorage.getItem("family-hub:device")).toBe("device-1");
    expect(localStorage.getItem("family-hub:later")).toBe("kept");
  });

  test("opens other links in a new tab", () => {
    const browser = fakeBrowser();
    const { telegram } = telegramIn(browser);

    telegram.openLink("https://t.me/family_hub_bot");

    expect(browser.opened).toEqual(["https://t.me/family_hub_bot"]);
  });
});
