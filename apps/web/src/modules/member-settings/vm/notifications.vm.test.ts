import { context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { reatomNotifications } from "./notifications.vm.ts";

function startNotifications({ canMessage = false, isAllowed = true } = {}) {
  const telegram = {
    requests: 0,
    async requestWriteAccess() {
      telegram.requests += 1;

      return isAllowed;
    },
  };

  return { model: reatomNotifications({ canMessage: () => canMessage, telegram }), telegram };
}

beforeEach(() => {
  context.reset();
});

describe("the «Включите уведомления» banner", () => {
  test("shows when the bot cannot message the Member", () => {
    const { model } = startNotifications({ canMessage: false });

    expect(model.isOff()).toBe(true);
  });

  test("stays away when the bot can message the Member", () => {
    const { model } = startNotifications({ canMessage: true });

    expect(model.isOff()).toBe(false);
  });

  test("goes away once the Member allows the bot to write", async () => {
    const { model, telegram } = startNotifications({ isAllowed: true });

    model.enable();

    await vi.waitFor(() => {
      expect(model.isOff()).toBe(false);
    });
    expect(telegram.requests).toBe(1);
  });

  test("stays when the Member declines", async () => {
    const { model } = startNotifications({ isAllowed: false });

    model.enable();
    await vi.waitFor(() => {
      expect(model.isEnabling()).toBe(false);
    });

    expect(model.isOff()).toBe(true);
  });
});
