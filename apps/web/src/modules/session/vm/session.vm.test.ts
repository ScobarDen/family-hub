import { context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { CurrentMember, SessionResponse } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import { createSessionApi } from "../session.api.ts";
import { reatomSession } from "./session.vm.ts";

const initData = "query_id=AAH&user=%7B%22id%22%3A111%7D&auth_date=1791100800&hash=abc";
const token = "session-token";

const denis: CurrentMember = {
  member: { id: "member-1", name: "Денис" },
  family: { id: "family-1", name: "Гущины" },
  isFamilyOwner: true,
};

const silence = Symbol("silence");

type Reply = SessionResponse | CurrentMember | number | Error | typeof silence;

async function respond(reply: Reply, signal: AbortSignal | null | undefined): Promise<Response> {
  if (reply === silence) {
    return new Promise((_resolve, reject) => {
      signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation timed out.", "TimeoutError"));
      });
    });
  }

  if (reply instanceof Error) {
    throw reply;
  }

  return typeof reply === "number"
    ? Response.json({ code: "UNAUTHENTICATED", message: "" }, { status: reply })
    : Response.json(reply);
}

function fakeBackend(replies: { session: Reply; me?: Reply }) {
  const requests: string[] = [];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    requests.push(url.pathname);

    if (url.pathname === "/api/session") {
      return respond(replies.session, init.signal);
    }

    const isAuthorized = new Headers(init.headers).get("authorization") === `Bearer ${token}`;

    return respond(isAuthorized ? (replies.me ?? denis) : 401, init.signal);
  }

  return { fetch, requests };
}

function fakeTelegram(launchInitData = initData) {
  const alerts: string[] = [];

  return {
    initData: launchInitData,
    showAlert(message: string) {
      alerts.push(message);
    },
    alerts,
  };
}

function startSession(backend: ReturnType<typeof fakeBackend>, telegram = fakeTelegram()) {
  const client = createHttpClient({
    baseUrl: "https://api.family-hub.test",
    fetch: backend.fetch,
    timeoutMs: 50,
  });

  return reatomSession({ api: createSessionApi(client), telegram });
}

async function signIn(session: ReturnType<typeof startSession>) {
  session.signIn();
  await vi.waitFor(() => {
    expect(session.screen()).not.toEqual({ kind: "signing-in" });
  });
}

beforeEach(() => {
  context.reset();
});

describe("signing in", () => {
  test("shows signing in until the backend answers", () => {
    const session = startSession(fakeBackend({ session: { status: "member", token } }));

    expect(session.screen()).toEqual({ kind: "signing-in" });
  });

  test("greets a Member by name with their Family", async () => {
    const session = startSession(fakeBackend({ session: { status: "member", token } }));

    await signIn(session);

    expect(session.screen()).toEqual({
      kind: "member",
      memberName: "Денис",
      familyName: "Гущины",
    });
  });

  test("shows the stranger screen to a Telegram user without a Family", async () => {
    const session = startSession(fakeBackend({ session: { status: "stranger" } }));

    await signIn(session);

    expect(session.screen()).toEqual({ kind: "stranger" });
  });

  test("asks to open the app from Telegram when there is no initData", async () => {
    const backend = fakeBackend({ session: { status: "member", token } });
    const session = startSession(backend, fakeTelegram(""));

    await signIn(session);

    expect(session.screen()).toEqual({ kind: "outside-telegram" });
    expect(backend.requests).toEqual([]);
  });

  test("offers to try again when the backend cannot be reached", async () => {
    const session = startSession(fakeBackend({ session: new TypeError("Failed to fetch") }));

    await signIn(session);

    expect(session.screen()).toEqual({ kind: "failed" });
  });
});

test("offers to try again when the backend does not answer", async () => {
  const session = startSession(fakeBackend({ session: silence }));

  await signIn(session);

  expect(session.screen()).toEqual({ kind: "failed" });
});

test("signs in on retry once the backend is back", async () => {
  const replies: { session: Reply } = { session: new TypeError("Failed to fetch") };
  const session = startSession(fakeBackend(replies));

  await signIn(session);
  replies.session = { status: "member", token };
  await signIn(session);

  expect(session.screen()).toEqual({ kind: "member", memberName: "Денис", familyName: "Гущины" });
});

describe("a lost session", () => {
  test("asks to restart the app when initData is rejected", async () => {
    const session = startSession(fakeBackend({ session: 401 }));

    await signIn(session);

    expect(session.screen()).toEqual({ kind: "restart" });
  });

  test("asks to restart the app when a later request gets 401", async () => {
    const session = startSession(fakeBackend({ session: { status: "member", token }, me: 401 }));

    await signIn(session);

    expect(session.screen()).toEqual({ kind: "restart" });
  });
});

describe("the stranger screen", () => {
  test("explains how to join by invitation", () => {
    const telegram = fakeTelegram();
    const session = startSession(fakeBackend({ session: { status: "stranger" } }), telegram);

    session.showInviteHelp();

    expect(telegram.alerts).toEqual([
      "Откройте ссылку-приглашение, которую вам прислал кто-то из семьи.",
    ]);
  });

  test("tells that creating a Family is coming soon", () => {
    const telegram = fakeTelegram();
    const session = startSession(fakeBackend({ session: { status: "stranger" } }), telegram);

    session.requestFamily();

    expect(telegram.alerts).toEqual(["Скоро здесь можно будет попросить создать свою семью."]);
  });
});
