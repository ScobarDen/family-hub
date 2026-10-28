import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { DigestSettings } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";
import { fakeHaptics } from "@/common/telegram";

import { createMemberSettingsApi } from "../member-settings.api.ts";
import { reatomDigest } from "./digest.vm.ts";

function startDigest({ isFailing = false } = {}) {
  const saved: unknown[] = [];

  async function fetch(_url: URL, init: RequestInit): Promise<Response> {
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;

    saved.push(body);

    return isFailing ? new Response(null, { status: 500 }) : Response.json(body);
  }

  const settings: DigestSettings = { isEnabled: true, time: "09:00" };
  const model = reatomDigest({
    api: createMemberSettingsApi(
      createHttpClient({ baseUrl: "https://api.family-hub.test", fetch }),
    ),
    saved: () => settings,
    haptics: fakeHaptics(),
  });

  model.isEnabled.subscribe(noop);
  model.time.subscribe(noop);

  return { model, saved };
}

beforeEach(() => {
  context.reset();
});

describe("the morning digest setting", () => {
  test("starts from the Member's settings and saves a new time", async () => {
    const { model, saved } = startDigest();

    expect([model.isEnabled(), model.time()]).toEqual([true, "09:00"]);

    model.chooseTime("07:30");
    model.chooseTime("7:3");

    await vi.waitFor(() => {
      expect(saved).toEqual([{ isEnabled: true, time: "07:30" }]);
    });
    expect(model.time()).toBe("07:30");
  });

  test("goes back and says so when the server refuses", async () => {
    const { model } = startDigest({ isFailing: true });

    model.toggle(false);

    expect(model.isEnabled()).toBe(false);

    await vi.waitFor(() => {
      expect(model.failure()).toBeDefined();
    });
    expect(model.isEnabled()).toBe(true);
  });
});
