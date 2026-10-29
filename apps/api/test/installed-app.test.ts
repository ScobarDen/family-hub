import { describe, expect, test } from "vite-plus/test";

import type { DeviceList, DeviceSignIn } from "@family-hub/contract";

import { signTelegramLogin, type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker } from "./worker-harness.ts";

const now = "2026-10-04T09:00:00Z";
const androidChrome =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

type Worker = ReturnType<typeof startWorker>;

function loginOf(worker: Worker, user: TelegramUserFixture = denis, authDate = worker.clock.iso()) {
  return signTelegramLogin({ botToken: worker.env.BOT_TOKEN, user, authDate });
}

async function postLogin(worker: Worker, login: unknown) {
  return worker.request("/api/session/telegram-login", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": androidChrome },
    body: JSON.stringify(login),
  });
}

async function signIn(worker: Worker, user: TelegramUserFixture = denis) {
  const response = await postLogin(worker, loginOf(worker, user));

  return response.json<DeviceSignIn>();
}

async function deviceStatus(worker: Worker, credential: string): Promise<number> {
  const response = await postDevice(worker, credential);

  return response.status;
}

async function postDevice(worker: Worker, credential: string) {
  return worker.request("/api/session/device", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ credential }),
  });
}

function withToken(token: string, init: RequestInit = {}): RequestInit {
  return { ...init, headers: { authorization: `Bearer ${token}` } };
}

async function startWithFamily() {
  const worker = startWorker({ now });
  const family = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  return { worker, ...family };
}

describe("signing in with Telegram Login", () => {
  test("a Member gets a session and a Device as in the Mini App", async () => {
    const { worker, familyId, ownerId } = await startWithFamily();

    const response = await postLogin(worker, loginOf(worker));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      token: expect.any(String),
      device: { id: expect.any(String), credential: expect.any(String) },
      member: { id: ownerId, name: "Денис" },
      family: { id: familyId, name: "Гущины" },
      isFamilyOwner: true,
      settings: expect.objectContaining({ reminderChannel: "both" }),
    });
  });

  test("a forged hash is refused", async () => {
    const { worker } = await startWithFamily();

    const response = await postLogin(worker, { ...loginOf(worker), first_name: "Ася" });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "TELEGRAM_LOGIN_INVALID" });
  });

  test("a login signed the initData way is refused", async () => {
    const { worker } = await startWithFamily();
    const login = loginOf(worker);

    const response = await postLogin(worker, { ...login, hash: "ab".repeat(32) });

    expect(response.status).toBe(401);
  });

  test("a login older than the initData limit is refused", async () => {
    const { worker } = await startWithFamily();
    const login = loginOf(worker, denis, "2026-10-04T07:59:00Z");

    const response = await postLogin(worker, login);

    expect(response.status).toBe(401);
  });

  test("a Telegram user who is not a Member is sent to the bot and gets no Device", async () => {
    const { worker } = await startWithFamily();

    const response = await postLogin(worker, loginOf(worker, asya));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "NOT_A_MEMBER" });
  });
});

describe("a Device", () => {
  test("trades its credential for a session token", async () => {
    const { worker, ownerId } = await startWithFamily();
    const { device } = await signIn(worker);

    const response = await postDevice(worker, device.credential);
    const { token } = await response.json<{ token: string }>();
    const me = await worker.request("/api/me", withToken(token));

    expect(response.status).toBe(200);
    expect(await me.json()).toMatchObject({ member: { id: ownerId } });
  });

  test("survives 89 days of disuse and dies at 90", async () => {
    const { worker } = await startWithFamily();
    const { device } = await signIn(worker);

    worker.clock.set("2027-01-01T09:00:00Z");
    expect(await deviceStatus(worker, device.credential)).toBe(200);

    worker.clock.set("2027-04-01T09:00:00Z");
    expect(await deviceStatus(worker, device.credential)).toBe(401);
    worker.clock.set("2027-01-02T09:00:00Z");
    expect(await deviceStatus(worker, device.credential)).toBe(401);
  });

  test("an unknown credential is refused", async () => {
    const { worker } = await startWithFamily();

    const response = await postDevice(worker, "not-a-credential");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "DEVICE_INVALID" });
  });

  test("of a Member removed from the Family gets no Family access", async () => {
    const { worker, familyId } = await startWithFamily();
    const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });
    const { device } = await signIn(worker, asya);

    await request(worker, denis, { method: "DELETE", path: `/api/family/members/${asyaId}` });
    const response = await postDevice(worker, device.credential);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "NOT_A_MEMBER" });
  });
});

describe("the Devices in the settings", () => {
  test("list where the Member is signed in, the most recent first", async () => {
    const { worker } = await startWithFamily();
    const first = await signIn(worker);

    worker.clock.set("2026-10-06T09:00:00Z");
    const second = await signIn(worker);

    const response = await worker.request("/api/devices", withToken(second.token));

    expect(await response.json<DeviceList>()).toEqual([
      {
        id: second.device.id,
        label: "Chrome · Android",
        createdAt: Date.parse("2026-10-06T09:00:00Z"),
        lastUsedAt: Date.parse("2026-10-06T09:00:00Z"),
      },
      {
        id: first.device.id,
        label: "Chrome · Android",
        createdAt: Date.parse(now),
        lastUsedAt: Date.parse(now),
      },
    ]);
  });

  test("a revoked Device, the current one included, can sign in no more", async () => {
    const { worker } = await startWithFamily();
    const { token, device } = await signIn(worker);

    const revoked = await worker.request(
      `/api/devices/${device.id}`,
      withToken(token, { method: "DELETE" }),
    );

    expect(await revoked.json()).toEqual({ status: "deleted" });
    expect(await deviceStatus(worker, device.credential)).toBe(401);
  });

  test("another Member's Device is not found", async () => {
    const { worker, familyId } = await startWithFamily();

    await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });
    const { device } = await signIn(worker, asya);
    const response = await request(worker, denis, {
      method: "DELETE",
      path: `/api/devices/${device.id}`,
    });

    expect(response.status).toBe(404);
    expect(await deviceStatus(worker, device.credential)).toBe(200);
  });
});
