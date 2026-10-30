import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { ReminderChannel } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client.api.ts";
import { fakeHaptics } from "@/modules/telegram";

import { createMemberSettingsApi } from "../member-settings.api.ts";
import { reatomReminderChannel } from "./reminder-channel.vm.ts";

function startChannel({
  isFailing = false,
  saved,
}: { isFailing?: boolean; saved?: ReminderChannel } = {}) {
  const sent: unknown[] = [];

  async function fetch(_url: URL, init: RequestInit): Promise<Response> {
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;

    sent.push(body);

    return isFailing ? new Response(null, { status: 500 }) : Response.json(body);
  }

  const model = reatomReminderChannel({
    api: createMemberSettingsApi(
      createHttpClient({ baseUrl: "https://api.family-hub.test", fetch }),
    ),
    saved: () => saved,
    haptics: fakeHaptics(),
  });

  model.channel.subscribe(noop);

  return { model, sent };
}

beforeEach(() => {
  context.reset();
});

describe("where Reminders go", () => {
  test("is both the bot and Push until the Member chooses", () => {
    expect(startChannel().model.channel()).toBe("both");
  });

  test("says «both» is the most reliable and «push» falls back to the bot", () => {
    expect(startChannel().model.hint()).toContain("Надёжнее всего");
    expect(startChannel({ saved: "push" }).model.hint()).toContain("напомнит бот");
  });

  test("starts from the Member's saved choice", () => {
    expect(startChannel({ saved: "telegram" }).model.channel()).toBe("telegram");
  });

  test("shows a choice at once and saves it", async () => {
    const { model, sent } = startChannel();

    model.choose("push");

    expect(model.channel()).toBe("push");
    await vi.waitFor(() => {
      expect(sent).toEqual([{ channel: "push" }]);
    });
  });

  test("goes back and says so when the server refuses", async () => {
    const { model } = startChannel({ isFailing: true });

    model.choose("push");

    await vi.waitFor(() => {
      expect(model.failure()).toBeDefined();
    });
    expect(model.channel()).toBe("both");
  });
});
