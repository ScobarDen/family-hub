import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { pushSubscription } from "@family-hub/contract";

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
  // Requests to the subscription the server answers with 500.
  failing?: "PUT" | "DELETE";
  // The endpoint the server keeps for this Device.
  saved?: string;
  isAndroid?: boolean;
};

// What the server keeps for this Device, and every request but the launch's read of it.
function fakeServer(options: Options) {
  let saved = options.saved ?? null;
  const requests: Array<{ path: string; method: string; body: unknown }> = [];

  function answer(url: URL, method: string, body: unknown): Response {
    if (url.pathname === "/api/push/key") {
      return Response.json({ publicKey: "BPublicKey" });
    }

    if (method === "GET") {
      return Response.json({ endpoint: saved });
    }

    if (method === "DELETE") {
      saved = null;

      return Response.json({ status: "deleted" });
    }

    saved = pushSubscription.parse(body).endpoint;

    return Response.json(body);
  }

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const method = init.method ?? "GET";
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;

    if (!(method === "GET" && url.pathname.endsWith("/push"))) {
      requests.push({ path: url.pathname, method, body });
    }

    return method === options.failing
      ? Response.json({ code: "INTERNAL", message: "" }, { status: 500 })
      : answer(url, method, body);
  }

  return { fetch, requests, saved: () => saved };
}

function startPush(options: Options = {}) {
  const server = fakeServer(options);
  const browser = fakeBrowserPlatform(options);
  const model = reatomPush({
    api: createMemberSettingsApi(
      createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: server.fetch }),
    ),
    platform: browser.platform,
    deviceId: () => "device-1",
    haptics: fakeHaptics(),
  });

  model.state.subscribe(noop);

  return { model, browser, requests: server.requests, server };
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

  test("stays off and drops the browser's subscription when the server does not save it", async () => {
    const { model, browser } = startPush({ failing: "PUT" });

    model.toggle(true);

    await vi.waitFor(() => {
      expect(model.failure()).toBe("Не получилось переключить Push. Попробуйте ещё раз.");
    });
    expect(model.state()).toBe("off");
    expect(browser.isSubscribed()).toBe(false);
  });

  test("stays on when the server does not forget the subscription", async () => {
    const { model, browser } = startPush({ failing: "DELETE" });

    model.toggle(true);
    await vi.waitFor(() => {
      expect(model.state()).toBe("on");
    });
    model.toggle(false);

    await vi.waitFor(() => {
      expect(model.failure()).toBe("Не получилось переключить Push. Попробуйте ещё раз.");
    });
    expect(model.state()).toBe("on");
    expect(browser.isSubscribed()).toBe(true);
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
    const { model, browser, requests } = startPush({
      permission: "granted",
      saved: fakePushSubscription.endpoint,
    });

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
    expect(model.canToggle()).toBe(false);
  });

  test("comes back on at launch when the server lost the subscription this browser holds", async () => {
    const { model, browser, server } = startPush({ permission: "granted" });

    browser.subscribe();
    await model.load();

    expect(model.state()).toBe("on");
    expect(server.saved()).toBe(fakePushSubscription.endpoint);
  });

  test("saves at launch the subscription the browser replaced", async () => {
    const { model, browser, server } = startPush({
      permission: "granted",
      saved: "https://fcm.googleapis.com/fcm/send/old",
    });

    browser.subscribe();
    await model.load();

    expect(model.state()).toBe("on");
    expect(server.saved()).toBe(fakePushSubscription.endpoint);
  });

  test("subscribes again at launch when the browser lost the subscription the Member wanted", async () => {
    const { model, browser } = startPush({ permission: "granted", saved: "https://old.test" });

    await model.load();

    expect(model.state()).toBe("on");
    expect(browser.isSubscribed()).toBe(true);
  });

  test("is off at launch and forgotten on the server once notifications are no longer allowed", async () => {
    const { model, server } = startPush({ permission: "default", saved: "https://old.test" });

    await model.load();

    expect(model.state()).toBe("off");
    expect(server.saved()).toBeNull();
  });

  test("is off at launch when the server cannot save what this browser holds", async () => {
    const { model, browser } = startPush({ permission: "granted", failing: "PUT" });

    browser.subscribe();
    await model.load();

    expect(model.state()).toBe("off");
  });

  test("on Android says how to keep battery saving from delaying Push", async () => {
    const { model, browser } = startPush({
      permission: "granted",
      saved: fakePushSubscription.endpoint,
      isAndroid: true,
    });

    browser.subscribe();
    await model.load();

    expect(model.hint()).toContain("экономии батареи");
  });
});
