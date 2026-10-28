import type { DeviceStorage } from "./telegram.types.ts";

// Telegram answers storage calls later, never inside the call.
function answer(callback: (() => void) | undefined): void {
  if (callback !== undefined) {
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
}: { isSupported?: boolean; isWriteFailing?: boolean } = {}): FakeDeviceStorage {
  const items = new Map<string, string>();

  const fake: FakeDeviceStorage = { deviceStorage: undefined, items, isWriteFailing };
  const deviceStorage: DeviceStorage = {
    setItem(key, value, callback) {
      if (fake.isWriteFailing) {
        answer(callback && (() => callback("QUOTA_EXCEEDED")));

        return;
      }

      items.set(key, value);
      answer(callback && (() => callback(null, true)));
    },
    getItem(key, callback) {
      answer(() => callback(null, items.get(key) ?? null));
    },
    removeItem(key, callback) {
      items.delete(key);
      answer(callback && (() => callback(null, true)));
    },
    clear(callback) {
      items.clear();
      answer(callback && (() => callback(null, true)));
    },
  };

  fake.deviceStorage = isSupported ? deviceStorage : undefined;

  return fake;
}
