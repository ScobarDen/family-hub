import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { createHttpClient } from "@/common/http-client.api.ts";
import {
  fakeBrowserPlatform,
  fakePushSubscription,
  type PushAvailability,
  type PushPermission,
} from "@/modules/browser-platform";
import { fakeHaptics } from "@/modules/telegram";

import { createMemberSettingsApi } from "../member-settings.api.ts";
import { reatomPush } from "./push.vm.ts";

type Options = {
  permission?: PushPermission;
  answer?: PushPermission;
  pushAvailability?: PushAvailability;
};

function startPush(options: Options = {}) {
  const requests: Array<{ path: string; method: string; body: unknown }> = [];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;

    requests.push({ path: url.pathname, method: init.method ?? "GET", body });

    if (url.pathname === "/api/push/key") {
      return Response.json({ publicKey: "BPublicKey" });
    }

    return Response.json(init.method === "DELETE" ? { status: "deleted" } : body);
  }

  const browser = fakeBrowserPlatform(options);
  const model = reatomPush({
    api: createMemberSettingsApi(
      createHttpClient({ baseUrl: "https://api.family-hub.test", fetch }),
    ),
    platform: browser.platform,
    deviceId: () => "device-1",
    haptics: fakeHaptics(),
  });

  model.state.subscribe(noop);

  return { model, browser, requests };
}

beforeEach(() => {
  context.reset();
});

describe("Push on this Device", () => {
  test("is off and asks for nothing at launch", async () => {
    const { model, browser } = startPush();

    await model.load();

    expect(model.state()).toBe("off");
    expect(browser.platform.pushPermission()).toBe("default");
  });

  test("asks the browser when turned on and saves the subscription for this Device", async () => {
    const { model, requests } = startPush();

    model.toggle(true);

    await vi.waitFor(() => {
      expect(model.state()).toBe("on");
    });
    expect(requests).toEqual([
      { path: "/api/push/key", method: "GET", body: undefined },
      { path: "/api/devices/device-1/push", method: "PUT", body: fakePushSubscription },
    ]);
  });

  test("says how to allow notifications when the Member denies them", async () => {
    const { model, requests } = startPush({ answer: "denied" });

    model.toggle(true);

    await vi.waitFor(() => {
      expect(model.state()).toBe("denied");
    });
    expect(model.hint()).toContain("настройках");
    expect(requests).toEqual([]);
  });

  test("turns off, dropping the subscription here and on the server", async () => {
    const { model, browser, requests } = startPush({ permission: "granted" });

    browser.subscribe();
    await model.load();
    model.toggle(false);

    await vi.waitFor(() => {
      expect(model.state()).toBe("off");
    });
    expect(browser.isSubscribed()).toBe(false);
    expect(requests).toEqual([
      { path: "/api/devices/device-1/push", method: "DELETE", body: undefined },
    ]);
  });

  test("asks to add the app to the home screen first on iOS", () => {
    const { model } = startPush({ pushAvailability: "needs-install" });

    expect(model.state()).toBe("needs-install");
    expect(model.hint()).toContain("«Домой»");
  });
});
