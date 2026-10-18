import { describe, expect, test } from "vite-plus/test";

import type { CurrentMember } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const now = "2026-10-04T09:00:00Z";
const denis = { id: 111, first_name: "Денис", allows_write_to_pm: true };
const asya = { id: 222, first_name: "Ася", allows_write_to_pm: true };

type Worker = ReturnType<typeof startWorker>;

async function sessionOf(worker: Worker, user: TelegramUserFixture): Promise<string> {
  const response = await worker.request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initData: signInitData({ botToken: worker.env.BOT_TOKEN, user, authDate: now }),
    }),
  });
  const { token } = await response.json<{ token: string }>();

  return token;
}

async function me(worker: Worker, user: TelegramUserFixture): Promise<CurrentMember> {
  const response = await worker.request("/api/me", {
    headers: { authorization: `Bearer ${await sessionOf(worker, user)}` },
  });

  return response.json<CurrentMember>();
}

async function put(
  worker: Worker,
  user: TelegramUserFixture,
  { path, body }: { path: string; body: unknown },
) {
  return worker.request(path, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${await sessionOf(worker, user)}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function startWithFamily() {
  const worker = startWorker({ now });
  const family = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  return { worker, ...family };
}

describe("the tab bar", () => {
  test("starts as Лента · Планы · Календарь · Питомец", async () => {
    const { worker } = await startWithFamily();

    const { settings } = await me(worker, denis);

    expect(settings.tabBar).toEqual(["feed", "plans", "calendar", "pet"]);
  });

  test("keeps the modules and order a Member saved for their next session", async () => {
    const { worker } = await startWithFamily();

    const response = await put(worker, denis, {
      path: "/api/me/tab-bar",
      body: {
        modules: ["goals", "feed", "albums"],
      },
    });
    const { settings } = await me(worker, denis);

    expect(await response.json()).toEqual({ modules: ["goals", "feed", "albums"] });
    expect(settings.tabBar).toEqual(["goals", "feed", "albums"]);
  });
});

describe("saving the tab bar", () => {
  test.each([
    ["a single module", ["feed"]],
    ["six modules", ["feed", "plans", "calendar", "pet", "goals", "albums"]],
    ["a repeated module", ["feed", "feed", "plans"]],
    ["an unknown module", ["feed", "shopping"]],
  ])("refuses %s", async (_case, modules) => {
    const { worker } = await startWithFamily();

    const response = await put(worker, denis, { path: "/api/me/tab-bar", body: { modules } });
    const { settings } = await me(worker, denis);

    expect(response.status).toBe(400);
    expect(settings.tabBar).toEqual(["feed", "plans", "calendar", "pet"]);
  });

  test("leaves the other Members' tab bars alone", async () => {
    const { worker, familyId } = await startWithFamily();

    await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });
    await put(worker, denis, { path: "/api/me/tab-bar", body: { modules: ["goals", "feed"] } });

    const { settings } = await me(worker, asya);

    expect(settings.tabBar).toEqual(["feed", "plans", "calendar", "pet"]);
  });

  test("needs a session", async () => {
    const { worker } = await startWithFamily();

    const response = await worker.request("/api/me/tab-bar", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modules: ["goals", "feed"] }),
    });

    expect(response.status).toBe(401);
  });
});

describe("the time zone", () => {
  test("is unknown until the Mini App reports one", async () => {
    const { worker } = await startWithFamily();

    const { settings } = await me(worker, denis);

    expect(settings.timeZone).toBeNull();
  });

  test("keeps the zone and whether it follows the device", async () => {
    const { worker } = await startWithFamily();

    await put(worker, denis, {
      path: "/api/me/time-zone",
      body: { timeZone: "Asia/Tbilisi", isAuto: false },
    });

    const { settings } = await me(worker, denis);

    expect(settings.timeZone).toEqual({ timeZone: "Asia/Tbilisi", isAuto: false });
  });

  test("refuses a name that is not an IANA zone", async () => {
    const { worker } = await startWithFamily();

    const response = await put(worker, denis, {
      path: "/api/me/time-zone",
      body: {
        timeZone: "Mars/Olympus",
        isAuto: true,
      },
    });

    expect(response.status).toBe(400);
  });
});

describe("whether the bot can message a Member", () => {
  test("is on for a new Member", async () => {
    const { worker } = await startWithFamily();

    const { settings } = await me(worker, { id: denis.id, first_name: "Денис" });

    expect(settings.canMessage).toBe(true);
  });

  test("stays off while Telegram does not report write access", async () => {
    const { worker, ownerId } = await startWithFamily();

    await worker.markUnreachable(ownerId);

    const { settings } = await me(worker, { ...denis, allows_write_to_pm: false });

    expect(settings.canMessage).toBe(false);
  });

  test("comes back once Telegram reports the Member allowed the bot to write", async () => {
    const { worker, ownerId } = await startWithFamily();

    await worker.markUnreachable(ownerId);

    const { settings } = await me(worker, denis);

    expect(settings.canMessage).toBe(true);
  });
});

describe("the Family's Members", () => {
  test("lists everyone in the Family and who owns it", async () => {
    const { worker, familyId, ownerId } = await startWithFamily();
    const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

    const response = await worker.request("/api/family/members", {
      headers: { authorization: `Bearer ${await sessionOf(worker, asya)}` },
    });

    expect(await response.json()).toEqual([
      { id: ownerId, name: "Денис", isFamilyOwner: true },
      { id: asyaId, name: "Ася", isFamilyOwner: false },
    ]);
  });

  test("leaves out other Families", async () => {
    const { worker } = await startWithFamily();

    await worker.addFamily({ name: "Соседи", owner: { telegramId: 333, name: "Вика" } });

    const response = await worker.request("/api/family/members", {
      headers: { authorization: `Bearer ${await sessionOf(worker, denis)}` },
    });

    expect(await response.json()).toHaveLength(1);
  });
});
