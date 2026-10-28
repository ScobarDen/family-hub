import { atom, context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { timeZoneSettings, type TimeZoneSettings } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";
import { fakeHaptics } from "@/common/telegram";

import { createMemberSettingsApi } from "../member-settings.api.ts";
import { reatomTimeZone } from "./time-zone.vm.ts";

function fakeBackend({ isDown = false } = {}) {
  const saved: TimeZoneSettings[] = [];

  async function fetch(_url: URL, init: RequestInit): Promise<Response> {
    if (isDown) {
      throw new TypeError("Failed to fetch");
    }

    const body = timeZoneSettings.parse(JSON.parse(typeof init.body === "string" ? init.body : ""));

    saved.push(body);

    return Response.json(body satisfies TimeZoneSettings);
  }

  return { fetch, saved };
}

function startTimeZone(saved?: TimeZoneSettings | null, backend = fakeBackend()) {
  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: backend.fetch });
  const member = atom(saved, "test.savedTimeZone");
  const model = reatomTimeZone({
    api: createMemberSettingsApi(client),
    saved: member,
    deviceZone: "Europe/Moscow",
    zones: ["Asia/Tbilisi", "Europe/Moscow"],
    haptics: fakeHaptics(),
  });

  model.keepFollowingDevice();

  return { model, member, backend };
}

async function settled(model: ReturnType<typeof startTimeZone>["model"]) {
  await vi.waitFor(() => {
    expect(model.isSaving()).toBe(false);
  });
}

beforeEach(() => {
  context.reset();
});

describe("following the device's zone", () => {
  test("takes the device's zone for a Member without one", async () => {
    const { model, backend } = startTimeZone(null);

    await settled(model);

    expect(backend.saved).toEqual([{ timeZone: "Europe/Moscow", isAuto: true }]);
    expect(model.zone()).toEqual({ timeZone: "Europe/Moscow", isAuto: true });
  });

  test("waits for the Member's settings before deciding", async () => {
    const { model, member, backend } = startTimeZone();

    expect(backend.saved).toEqual([]);
    member.set({ timeZone: "Asia/Tbilisi", isAuto: true });
    await settled(model);

    expect(backend.saved).toEqual([{ timeZone: "Europe/Moscow", isAuto: true }]);
  });

  test("leaves a zone that already matches the device alone", async () => {
    const { model, backend } = startTimeZone({ timeZone: "Europe/Moscow", isAuto: true });

    await settled(model);

    expect(backend.saved).toEqual([]);
  });

  test("keeps a zone the Member chose by hand", async () => {
    const { model, backend } = startTimeZone({ timeZone: "Asia/Tbilisi", isAuto: false });

    await settled(model);

    expect(backend.saved).toEqual([]);
    expect(model.zone()).toEqual({ timeZone: "Asia/Tbilisi", isAuto: false });
  });
});

describe("changing the zone in the Profile", () => {
  test("saves a zone chosen by hand", async () => {
    const { model, backend } = startTimeZone({ timeZone: "Europe/Moscow", isAuto: true });

    model.choose("Asia/Tbilisi");

    expect(model.zone()).toEqual({ timeZone: "Asia/Tbilisi", isAuto: false });
    await settled(model);
    expect(backend.saved).toEqual([{ timeZone: "Asia/Tbilisi", isAuto: false }]);
  });

  test("goes back to the device's zone", async () => {
    const { model, backend } = startTimeZone({ timeZone: "Asia/Tbilisi", isAuto: false });

    model.followDevice(true);
    await settled(model);

    expect(backend.saved).toEqual([{ timeZone: "Europe/Moscow", isAuto: true }]);
  });

  test("stops following the device and keeps the zone it had", async () => {
    const { model, backend } = startTimeZone({ timeZone: "Europe/Moscow", isAuto: true });

    model.followDevice(false);
    await settled(model);

    expect(backend.saved).toEqual([{ timeZone: "Europe/Moscow", isAuto: false }]);
  });

  test("puts the zone back when saving fails", async () => {
    const { model } = startTimeZone(
      { timeZone: "Europe/Moscow", isAuto: true },
      fakeBackend({ isDown: true }),
    );

    model.choose("Asia/Tbilisi");
    await settled(model);

    expect(model.zone()).toEqual({ timeZone: "Europe/Moscow", isAuto: true });
    expect(model.failure()).toBe("Не получилось сохранить часовой пояс. Попробуйте ещё раз.");
  });
});
