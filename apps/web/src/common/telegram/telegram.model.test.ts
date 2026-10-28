import { context, noop } from "@reatom/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { reatomTelegram } from "./telegram.model.ts";
import type { BottomButton, TelegramButton, TelegramWebApp } from "./telegram.types.ts";

const button: TelegramButton = { show: noop, hide: noop, onClick: noop, offClick: noop };
const bottomButton: BottomButton = {
  ...button,
  setParams: noop,
  showProgress: noop,
  hideProgress: noop,
};

function fakeWebApp({ version = "9.0" } = {}) {
  const calls: string[] = [];
  const webApp: TelegramWebApp = {
    initData: "",
    initDataUnsafe: {},
    platform: "ios",
    colorScheme: "light",
    ready: () => calls.push("ready"),
    expand: () => calls.push("expand"),
    showAlert: noop,
    showPopup: noop,
    isVersionAtLeast: (wanted) => Number.parseFloat(version) >= Number.parseFloat(wanted),
    requestWriteAccess: noop,
    shareMessage: noop,
    openTelegramLink: noop,
    HapticFeedback: {
      impactOccurred: (style) => calls.push(`impact ${style}`),
      notificationOccurred: (type) => calls.push(type),
      selectionChanged: () => calls.push("select"),
    },
    enableVerticalSwipes: noop,
    disableVerticalSwipes: noop,
    DeviceStorage: { setItem: noop, getItem: noop, removeItem: noop, clear: noop },
    MainButton: bottomButton,
    SecondaryButton: bottomButton,
    BackButton: button,
    SettingsButton: button,
    onEvent: noop,
    offEvent: noop,
  };

  return { webApp, calls };
}

function pendingRead() {
  let resolve = noop;
  const read = new Promise<void>((done) => {
    resolve = done;
  });

  return { read, resolve };
}

beforeEach(() => {
  context.reset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("keeps Telegram's placeholder until the first screen is read", async () => {
  const { webApp, calls } = fakeWebApp();
  const { read, resolve } = pendingRead();

  reatomTelegram(webApp).launch(read);
  await vi.advanceTimersByTimeAsync(100);
  expect(calls).toEqual(["expand"]);
  resolve();
  await vi.advanceTimersByTimeAsync(0);

  expect(calls).toEqual(["expand", "ready"]);
});

test("shows the app after about 300 ms when the read takes longer", async () => {
  const { webApp, calls } = fakeWebApp();

  reatomTelegram(webApp).launch(new Promise(noop));
  await vi.advanceTimersByTimeAsync(299);
  expect(calls).toEqual(["expand"]);
  await vi.advanceTimersByTimeAsync(1);

  expect(calls).toEqual(["expand", "ready"]);
});

test("shows the app once even when the read finishes after the 300 ms", async () => {
  const { webApp, calls } = fakeWebApp();
  const { read, resolve } = pendingRead();

  reatomTelegram(webApp).launch(read);
  await vi.advanceTimersByTimeAsync(300);
  resolve();
  await vi.advanceTimersByTimeAsync(0);

  expect(calls).toEqual(["expand", "ready"]);
});

describe("haptics", () => {
  test("gives each feedback Telegram's own way", () => {
    const { webApp, calls } = fakeWebApp();
    const { haptics } = reatomTelegram(webApp);

    haptics.select();
    haptics.success();
    haptics.warning();
    haptics.error();
    haptics.impact("medium");

    expect(calls).toEqual(["select", "success", "warning", "error", "impact medium"]);
  });

  test("lets the same feedback through once per 80 ms, and different ones at once", async () => {
    const { webApp, calls } = fakeWebApp();
    const { haptics } = reatomTelegram(webApp);

    haptics.success();
    haptics.success();
    haptics.select();
    await vi.advanceTimersByTimeAsync(79);
    haptics.success();
    await vi.advanceTimersByTimeAsync(1);
    haptics.success();

    expect(calls).toEqual(["success", "select", "success"]);
  });

  test("stays silent on a client older than 6.1", () => {
    const { webApp, calls } = fakeWebApp({ version: "6.0" });
    const { haptics } = reatomTelegram(webApp);

    haptics.success();
    haptics.select();

    expect(calls).toEqual([]);
  });
});
