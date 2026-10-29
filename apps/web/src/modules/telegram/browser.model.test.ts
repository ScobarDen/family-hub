import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { reatomBrowserWebApp, type BrowserWindow } from "./browser.model.ts";
import { reatomTelegram } from "./telegram.model.ts";

type Listener = () => void;

function fakeBrowser({
  search = "",
  isDark = false,
  canShare = true,
}: { search?: string; isDark?: boolean; canShare?: boolean } = {}) {
  const media = { matches: isDark, listeners: new Set<Listener>() };
  const opened: string[] = [];
  const shared: ShareData[] = [];
  const copied: string[] = [];
  const alerts: string[] = [];
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
    localStorage: globalThis.localStorage,
    addEventListener: noop,
    removeEventListener: noop,
  } as unknown as BrowserWindow;

  return {
    window,
    opened,
    shared,
    copied,
    alerts,
    turnDark() {
      media.matches = true;

      for (const listener of media.listeners) {
        listener();
      }
    },
  };
}

function telegramIn(browser: ReturnType<typeof fakeBrowser>) {
  const { webApp, back } = reatomBrowserWebApp(browser.window);

  return { telegram: reatomTelegram(webApp), back };
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

  test("shows its own back button where Telegram's Back would be", () => {
    const { telegram, back } = telegramIn(fakeBrowser());
    const pressed = vi.fn<() => void>();
    const shown = { current: false };
    const stop = telegram.backButton.follow(() => shown.current, pressed);

    expect(back.isVisible()).toBe(false);

    stop();
    shown.current = true;
    const restarted = telegram.backButton.follow(() => shown.current, pressed);

    expect(back.isVisible()).toBe(true);

    back.press();

    expect(pressed).toHaveBeenCalledOnce();
    restarted();
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

  test("opens other links in a new tab", () => {
    const browser = fakeBrowser();
    const { telegram } = telegramIn(browser);

    telegram.openLink("https://t.me/family_hub_bot");

    expect(browser.opened).toEqual(["https://t.me/family_hub_bot"]);
  });
});
