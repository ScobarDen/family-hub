import { effect, noop } from "@reatom/core";

import type { BottomButtonState } from "./model/telegram.model.ts";
import type { ClosingConfirmation, Fullscreen, Haptics, HomeScreen } from "./telegram.lib.ts";
import type { DeviceStorage, HomeScreenStatus } from "./telegram.types.ts";

// Telegram answers storage calls later, never inside the call.
function answer(callback: (() => void) | undefined, isSilent = false): void {
  if (callback !== undefined && !isSilent) {
    queueMicrotask(callback);
  }
}

export type FakeDeviceStorage = {
  deviceStorage: DeviceStorage | undefined;
  items: Map<string, string>;
  isWriteFailing: boolean;
};

export function fakeDeviceStorage({
  isSupported = true,
  isWriteFailing = false,
  isSilent = false,
}: {
  isSupported?: boolean;
  isWriteFailing?: boolean;
  // A client whose DeviceStorage never calls back.
  isSilent?: boolean;
} = {}): FakeDeviceStorage {
  const items = new Map<string, string>();

  const fake: FakeDeviceStorage = { deviceStorage: undefined, items, isWriteFailing };

  const deviceStorage: DeviceStorage = {
    setItem(key, value, callback) {
      if (fake.isWriteFailing) {
        answer(callback && (() => callback("QUOTA_EXCEEDED")), isSilent);

        return;
      }

      items.set(key, value);
      answer(callback && (() => callback(null, true)), isSilent);
    },
    getItem(key, callback) {
      answer(() => callback(null, items.get(key) ?? null), isSilent);
    },
    removeItem(key, callback) {
      items.delete(key);
      answer(callback && (() => callback(null, true)), isSilent);
    },
    clear(callback) {
      items.clear();
      answer(callback && (() => callback(null, true)), isSilent);
    },
  };

  fake.deviceStorage = isSupported ? deviceStorage : undefined;

  return fake;
}

export type FakeBottomButton = {
  isAvailable: boolean;
  follow(state: () => BottomButtonState | undefined, onClick: () => void): () => void;
  states: Array<BottomButtonState | undefined>;
  click(): void;
};

export function fakeBottomButton({ isAvailable = true } = {}): FakeBottomButton {
  let onClick = noop;
  const fake: FakeBottomButton = {
    isAvailable,
    states: [],
    click: () => {
      onClick();
    },
    follow(state, handler) {
      if (!isAvailable) {
        return noop;
      }

      onClick = handler;

      const shown = effect(() => {
        fake.states.push(state());
      }, "fakeBottomButton");

      return () => {
        shown.unsubscribe();
        onClick = noop;
        fake.states.push(undefined);
      };
    },
  };

  return fake;
}

// Records every feedback in order, as the ViewModel asked for it, before the wrapper's throttle.
export type FakeHaptics = Haptics & { felt: string[] };

export function fakeHaptics(): FakeHaptics {
  const felt: string[] = [];

  function record(feedback: string): void {
    felt.push(feedback);
  }

  return {
    felt,
    select: () => {
      record("select");
    },
    success: () => {
      record("success");
    },
    warning: () => {
      record("warning");
    },
    error: () => {
      record("error");
    },
    impact: (style) => {
      record(`impact ${style}`);
    },
  };
}

export type FakeWindow = HomeScreen & Fullscreen & ClosingConfirmation & { calls: string[] };

export function fakeWindow({
  homeScreenStatus = "missed",
}: { homeScreenStatus?: HomeScreenStatus } = {}): FakeWindow {
  const calls: string[] = [];

  function record(call: string): () => void {
    return () => {
      calls.push(call);
    };
  }

  return {
    calls,
    addToHomeScreen: record("addToHomeScreen"),
    checkHomeScreenStatus: async () => {
      calls.push("checkHomeScreenStatus");

      return homeScreenStatus;
    },
    requestFullscreen: record("requestFullscreen"),
    exitFullscreen: record("exitFullscreen"),
    isClosingConfirmationEnabled: () =>
      calls.findLast((call) => call.endsWith("ClosingConfirmation")) ===
      "enableClosingConfirmation",
    enableClosingConfirmation: record("enableClosingConfirmation"),
    disableClosingConfirmation: record("disableClosingConfirmation"),
  };
}
