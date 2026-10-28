import { atom, context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { z } from "zod";

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
  settings: {
    tabBar: ["goals", "pet"],
    timeZone: { timeZone: "Europe/Moscow", isAuto: true },
    canMessage: true,
    digest: { isEnabled: true, time: "09:00" },
  },
};

const signedIn: SessionResponse = { status: "member", token, ...denis };

const silence = Symbol("silence");

type Reply = SessionResponse | number | Error | typeof silence;

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

function fakeBackend(replies: { session: Reply; later?: Reply }) {
  const requests: string[] = [];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    requests.push(url.pathname);

    if (url.pathname === "/api/session") {
      return respond(replies.session, init.signal);
    }

    const isAuthorized = new Headers(init.headers).get("authorization") === `Bearer ${token}`;

    return respond(isAuthorized ? (replies.later ?? 401) : 401, init.signal);
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

function startSession(
  backend: ReturnType<typeof fakeBackend>,
  telegram = fakeTelegram(),
  isJoiningFamily = atom(false, "test.isJoiningFamily"),
) {
  const client = createHttpClient({
    baseUrl: "https://api.family-hub.test",
    fetch: backend.fetch,
    timeoutMs: 50,
  });

  return Object.assign(
    reatomSession({ api: createSessionApi(client), telegram, isJoiningFamily }),
    { client },
  );
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
  test("greets a Member by name with their Family", async () => {
    const session = startSession(fakeBackend({ session: signedIn }));

    await signIn(session);

    expect(session.screen()).toEqual({
      kind: "member",
      memberName: "Денис",
      familyName: "Гущины",
    });
  });

  test("signs in with a single request", async () => {
    const backend = fakeBackend({ session: signedIn });
    const session = startSession(backend);

    await signIn(session);

    expect(backend.requests).toEqual(["/api/session"]);
  });

  test("hands the signed-in Member's settings to the rest of the app", async () => {
    const session = startSession(fakeBackend({ session: signedIn }));

    expect(session.member()).toBeUndefined();
    await signIn(session);

    expect(session.member()?.settings.tabBar).toEqual(["goals", "pet"]);
  });

  test("shows the stranger screen to a Telegram user without a Family", async () => {
    const session = startSession(
      fakeBackend({ session: { status: "stranger", familyRequest: "none" } }),
    );

    await signIn(session);

    expect(session.screen()).toEqual({ kind: "stranger" });
  });

  test("asks to open the app from Telegram when there is no initData", async () => {
    const backend = fakeBackend({ session: signedIn });
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
  replies.session = signedIn;
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
    const session = startSession(fakeBackend({ session: signedIn, later: 401 }));

    await signIn(session);
    await session.client.request("/api/today", { schema: z.unknown() }).catch(noop);

    expect(session.screen()).toEqual({ kind: "restart" });
  });
});

describe("the stranger screen", () => {
  test("explains how to join by invitation", () => {
    const telegram = fakeTelegram();
    const session = startSession(
      fakeBackend({ session: { status: "stranger", familyRequest: "none" } }),
      telegram,
    );

    session.showInviteHelp();

    expect(telegram.alerts).toEqual([
      "Откройте ссылку-приглашение, которую вам прислал кто-то из семьи.",
    ]);
  });

  test("opens the Family Request form", async () => {
    const session = startSession(
      fakeBackend({ session: { status: "stranger", familyRequest: "none" } }),
    );

    await signIn(session);
    session.requestFamily();

    expect(session.screen()).toEqual({ kind: "family-request" });
  });

  test("goes straight to a Family Request that is still waiting for approval", async () => {
    const session = startSession(
      fakeBackend({ session: { status: "stranger", familyRequest: "pending" } }),
    );

    await signIn(session);

    expect(session.screen()).toEqual({ kind: "family-request" });
    expect(session.familyRequestStatus()).toBe("pending");
  });

  test("keeps the stranger screen during the cooldown, where an invitation still works", async () => {
    const session = startSession(
      fakeBackend({ session: { status: "stranger", familyRequest: "cooldown" } }),
    );

    await signIn(session);

    expect(session.screen()).toEqual({ kind: "stranger" });
  });

  test("goes back from the Family Request form", async () => {
    const session = startSession(
      fakeBackend({ session: { status: "stranger", familyRequest: "none" } }),
    );

    await signIn(session);
    session.requestFamily();
    session.closeFamilyRequest();

    expect(session.screen()).toEqual({ kind: "stranger" });
  });

  test("lets a requester whose Family was created in", async () => {
    const replies: { session: Reply } = { session: { status: "stranger", familyRequest: "none" } };
    const session = startSession(fakeBackend(replies));

    await signIn(session);
    session.requestFamily();
    replies.session = signedIn;
    session.signIn();

    await vi.waitFor(() => {
      expect(session.screen()).toEqual({
        kind: "member",
        memberName: "Денис",
        familyName: "Гущины",
      });
    });
  });
});

describe("opening the app from an Invite", () => {
  test("shows the invitation instead of the stranger screen", async () => {
    const session = startSession(
      fakeBackend({ session: { status: "stranger", familyRequest: "none" } }),
      fakeTelegram(),
      atom(true, "test.isJoiningFamily"),
    );

    await vi.waitFor(() => {
      expect(session.screen()).toEqual({ kind: "join-family" });
    });
  });

  test("shows the invitation while signing in is still going", () => {
    const session = startSession(
      fakeBackend({ session: silence }),
      fakeTelegram(),
      atom(true, "test.isJoiningFamily"),
    );

    session.signIn();

    expect(session.screen()).toEqual({ kind: "join-family" });
  });

  test("still asks to restart the app when the session is lost", async () => {
    const session = startSession(
      fakeBackend({ session: 401 }),
      fakeTelegram(),
      atom(true, "test.isJoiningFamily"),
    );

    session.signIn();

    await vi.waitFor(() => {
      expect(session.screen()).toEqual({ kind: "restart" });
    });
  });

  test("signs in again once the person has joined, without flashing the stranger screen", async () => {
    const replies: { session: Reply } = { session: { status: "stranger", familyRequest: "none" } };
    const isJoiningFamily = atom(true, "test.isJoiningFamily");
    const session = startSession(fakeBackend(replies), fakeTelegram(), isJoiningFamily);

    await signIn(session);
    replies.session = signedIn;
    isJoiningFamily.set(false);
    session.signIn();

    expect(session.screen()).toEqual({ kind: "signing-in" });
    await vi.waitFor(() => {
      expect(session.screen()).toMatchObject({ kind: "member", familyName: "Гущины" });
    });
  });
});
