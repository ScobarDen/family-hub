import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { Device } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client.api.ts";
import { fakeHaptics } from "@/modules/telegram";

import { createMemberSettingsApi } from "../member-settings.api.ts";
import { reatomDevices } from "./devices.vm.ts";

const phone: Device = {
  id: "device-phone",
  label: "Chrome · Android",
  createdAt: Date.parse("2026-10-01T09:00:00Z"),
  lastUsedAt: Date.parse("2026-10-28T09:00:00Z"),
};
const laptop: Device = { ...phone, id: "device-laptop", label: "Edge · Windows" };

function startDevices({ answers = ["confirm"] }: { answers?: string[] } = {}) {
  const requests: string[] = [];
  let devices = [phone, laptop];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    requests.push(`${init.method ?? "GET"} ${url.pathname}`);

    if (init.method === "DELETE") {
      devices = devices.filter(({ id }) => !url.pathname.endsWith(id));

      return Response.json({ status: "deleted" });
    }

    return Response.json(devices);
  }

  const signedOut = vi.fn<() => Promise<void>>(async () => Promise.resolve());
  const model = reatomDevices({
    api: createMemberSettingsApi(
      createHttpClient({ baseUrl: "https://api.family-hub.test", fetch }),
    ),
    currentDeviceId: () => "device-phone",
    telegram: { showPopup: async () => answers.shift() ?? "confirm", haptics: fakeHaptics() },
    viewer: () => ({ timeZone: "Europe/Moscow", today: "2026-10-29" }),
    onSignedOut: signedOut,
  });

  model.devices.subscribe(noop);

  return { model, requests, signedOut };
}

async function listed(model: ReturnType<typeof startDevices>["model"]) {
  await vi.waitFor(() => {
    expect(model.devices()).toHaveLength(2);
  });
}

beforeEach(() => {
  context.reset();
});

describe("the Devices in the settings", () => {
  test("list where the Member is signed in and mark this one", async () => {
    const { model } = startDevices();

    await listed(model);

    expect(model.devices()).toEqual([
      {
        id: "device-phone",
        title: "Chrome · Android — это устройство",
        lastUsed: "Заходили 28 октября",
        signOutLabel: "Выйти на этом устройстве",
      },
      {
        id: "device-laptop",
        title: "Edge · Windows",
        lastUsed: "Заходили 28 октября",
        signOutLabel: "Выйти на устройстве Edge · Windows",
      },
    ]);
  });

  test("sign out of another Device after asking", async () => {
    const { model, signedOut } = startDevices();

    await listed(model);
    model.revoke("device-laptop");

    await vi.waitFor(() => {
      expect(model.devices().map(({ id }) => id)).toEqual(["device-phone"]);
    });
    expect(signedOut).not.toHaveBeenCalled();
  });

  test("sign out of this Device to the sign-in screen", async () => {
    const { model, signedOut } = startDevices();

    await listed(model);
    model.revoke("device-phone");

    await vi.waitFor(() => {
      expect(signedOut).toHaveBeenCalledOnce();
    });
  });

  test("keep a Device when the Member changes their mind", async () => {
    const { model, requests } = startDevices({ answers: ["cancel", "confirm"] });

    await listed(model);
    model.revoke("device-laptop");
    model.revoke("device-laptop");

    await vi.waitFor(() => {
      expect(model.devices()).toHaveLength(1);
    });
    expect(requests).toEqual(["GET /api/devices", "DELETE /api/devices/device-laptop"]);
  });
});
