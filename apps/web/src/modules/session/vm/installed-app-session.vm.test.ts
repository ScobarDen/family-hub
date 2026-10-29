import { atom, context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { z } from "zod";

import type {
  CurrentMember,
  DeviceSession,
  LoginSession,
  ErrorCode,
  TelegramWidgetLogin,
} from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client.api.ts";
import { reatomDeviceCache } from "@/modules/device-cache";
import { fakeDeviceStorage } from "@/modules/telegram";

import { createSessionApi } from "../session.api.ts";
import { memoryStorage } from "../session.fixtures.ts";
import { reatomSession } from "./session.vm.ts";

const denis: CurrentMember = {
  member: { id: "member-1", name: "Денис" },
  family: { id: "family-1", name: "Гущины" },
  isFamilyOwner: true,
  settings: {
    tabBar: ["tasks", "pet"],
    timeZone: null,
    canMessage: true,
    digest: { isEnabled: true, time: "09:00" },
    reminderChannel: "both",
  },
};

const login: TelegramWidgetLogin = {
  id: 111,
  first_name: "Денис",
  auth_date: 1_791_100_800,
  hash: "ab".repeat(32),
};

const device = { id: "device-1", credential: "credential-1" };
const deviceKey = "family-hub:device";

type Refusal = { status: number; code: ErrorCode };

type Replies = {
  login?: LoginSession | Refusal;
  device?: DeviceSession | Refusal | "offline";
  // What a session request answers to each token, in turn.
  today?: number[];
};

function refusal(status: number, code: ErrorCode): Refusal {
  return { status, code };
}

function answer(reply: object | Refusal | undefined): Response {
  if (reply !== undefined && "code" in reply) {
    return Response.json({ code: reply.code, message: "" }, { status: reply.status });
  }

  return Response.json(reply ?? {});
}

function fakeBackend(replies: Replies) {
  const requests: string[] = [];

  async function fetch(url: URL): Promise<Response> {
    requests.push(url.pathname);

    if (url.pathname === "/api/session/telegram-login") {
      return answer(replies.login);
    }

    if (url.pathname === "/api/session/device") {
      if (replies.device === "offline") {
        throw new TypeError("Failed to fetch");
      }

      return answer(replies.device);
    }

    if (url.pathname.startsWith("/api/devices/")) {
      return Response.json({ status: "deleted" });
    }

    const status = replies.today?.shift() ?? 200;

    return status === 200 ? Response.json({}) : answer(refusal(status, "UNAUTHENTICATED"));
  }

  return { fetch, requests };
}

function startInstalledApp(
  backend: ReturnType<typeof fakeBackend>,
  storage = memoryStorage(),
  cache = fakeDeviceStorage(),
) {
  const client = createHttpClient({
    baseUrl: "https://api.family-hub.test",
    fetch: backend.fetch,
    timeoutMs: 50,
    holdUntilSignedIn: true,
    reauthenticate: async () => api.reauthenticate(),
  });
  const api = createSessionApi(client, storage);
  const session = reatomSession({
    api,
    telegram: { initData: "", isInTelegram: false, startParam: undefined, showAlert: noop },
    isJoiningFamily: atom(false, "test.isJoiningFamily"),
    deviceCache: reatomDeviceCache(cache.deviceStorage),
    botUsername: "family_hub_bot",
  });

  return Object.assign(session, { client, storage });
}

async function settled(session: ReturnType<typeof startInstalledApp>) {
  await vi.waitFor(() => {
    expect(session.screen()).not.toEqual({ kind: "signing-in" });
  });

  return session.screen();
}

const member = { kind: "member", memberName: "Денис", familyName: "Гущины" };

beforeEach(() => {
  context.reset();
});

describe("the Installed App's first launch", () => {
  test("asks to sign in with Telegram, asking the server nothing", async () => {
    const backend = fakeBackend({});
    const session = startInstalledApp(backend);

    session.signIn();

    expect(await settled(session)).toEqual({ kind: "signed-out" });
    expect(backend.requests).toEqual([]);
  });

  test("signs the Member in with Telegram Login and keeps the Device", async () => {
    const session = startInstalledApp(
      fakeBackend({ login: { ...denis, token: "token-1", device } }),
    );

    session.loginWith(login);

    await vi.waitFor(() => {
      expect(session.screen()).toEqual(member);
    });
    expect(JSON.parse(session.storage.items.get(deviceKey) ?? "")).toEqual(device);
    expect(session.currentDeviceId()).toBe("device-1");
  });

  test("tells a Telegram user without a Family that the app is for Members", async () => {
    const session = startInstalledApp(fakeBackend({ login: refusal(403, "NOT_A_MEMBER") }));

    session.loginWith(login);

    await vi.waitFor(() => {
      expect(session.screen()).toEqual({ kind: "not-member" });
    });
    expect(session.storage.items.has(deviceKey)).toBe(false);
  });

  test("ignores what is not a Telegram Login", async () => {
    const backend = fakeBackend({ login: { ...denis, token: "token-1", device } });
    const session = startInstalledApp(backend);

    session.loginWith({ id: "not a number" });
    session.loginWith(login);

    await vi.waitFor(() => {
      expect(session.screen()).toEqual(member);
    });
    expect(backend.requests).toEqual(["/api/session/telegram-login"]);
  });
});

function storageWithDevice() {
  const storage = memoryStorage();

  storage.setItem(deviceKey, JSON.stringify(device));

  return storage;
}

describe("a later launch", () => {
  test("signs in with the kept Device", async () => {
    const backend = fakeBackend({ device: { ...denis, token: "token-1" } });
    const session = startInstalledApp(backend, storageWithDevice());

    session.signIn();

    expect(await settled(session)).toEqual(member);
    expect(backend.requests).toEqual(["/api/session/device"]);
  });

  test("goes back to sign-in and forgets a refused Device", async () => {
    const session = startInstalledApp(
      fakeBackend({ device: refusal(401, "DEVICE_INVALID") }),
      storageWithDevice(),
    );

    session.signIn();

    expect(await settled(session)).toEqual({ kind: "signed-out" });
    expect(session.storage.items.has(deviceKey)).toBe(false);
  });

  test("tells a Member removed from the Family that the app is for Members", async () => {
    const session = startInstalledApp(
      fakeBackend({ device: refusal(403, "NOT_A_MEMBER") }),
      storageWithDevice(),
    );

    session.signIn();

    expect(await settled(session)).toEqual({ kind: "not-member" });
  });

  test("signs in again through the Device once when a request gets 401", async () => {
    const backend = fakeBackend({ device: { ...denis, token: "token-1" }, today: [401, 200] });
    const session = startInstalledApp(backend, storageWithDevice());

    session.signIn();
    await settled(session);
    const today = await session.client.request("/api/today", { schema: z.unknown() });

    expect(today).toEqual({});
    expect(session.screen()).toEqual(member);
    expect(backend.requests).toEqual([
      "/api/session/device",
      "/api/today",
      "/api/session/device",
      "/api/today",
    ]);
  });

  test("signs in again only once for requests that get 401 together", async () => {
    const backend = fakeBackend({
      device: { ...denis, token: "token-1" },
      today: [401, 401, 200, 200],
    });
    const session = startInstalledApp(backend, storageWithDevice());

    session.signIn();
    await settled(session);
    await Promise.all([
      session.client.request("/api/today", { schema: z.unknown() }),
      session.client.request("/api/today", { schema: z.unknown() }),
    ]);

    expect(backend.requests.filter((path) => path === "/api/session/device")).toHaveLength(2);
  });

  test("asks to restart and keeps the Device when signing in again gets no answer", async () => {
    const replies: Replies = { device: { ...denis, token: "token-1" }, today: [401] };
    const session = startInstalledApp(fakeBackend(replies), storageWithDevice());

    session.signIn();
    await settled(session);
    replies.device = "offline";
    await session.client.request("/api/today", { schema: z.unknown() }).catch(noop);

    expect(session.screen()).toEqual({ kind: "restart" });
    expect(session.storage.items.has(deviceKey)).toBe(true);
  });

  test("goes back to sign-in when the Device is refused on the way", async () => {
    const replies: Replies = { device: { ...denis, token: "token-1" }, today: [401] };
    const session = startInstalledApp(fakeBackend(replies), storageWithDevice());

    session.signIn();
    await settled(session);
    replies.device = refusal(401, "DEVICE_INVALID");
    await session.client.request("/api/today", { schema: z.unknown() }).catch(noop);

    expect(session.screen()).toEqual({ kind: "signed-out" });
  });

  test("signs out of this Device back to the sign-in screen, revoking it on the server", async () => {
    const backend = fakeBackend({ device: { ...denis, token: "token-1" } });
    const session = startInstalledApp(backend, storageWithDevice());

    session.signIn();
    await settled(session);
    await session.signOut();

    expect(session.screen()).toEqual({ kind: "signed-out" });
    expect(session.storage.items.has(deviceKey)).toBe(false);
    expect(backend.requests).toContain("/api/devices/device-1");
  });

  test("forgets the signed-out Member's cached data", async () => {
    const backend = fakeBackend({ device: { ...denis, token: "token-1" } });
    const cache = fakeDeviceStorage();
    const session = startInstalledApp(backend, storageWithDevice(), cache);

    session.signIn();
    await settled(session);
    await vi.waitFor(() => {
      expect(cache.items.size).toBeGreaterThan(0);
    });
    await session.signOut();

    expect(cache.items.size).toBe(0);
  });
});
