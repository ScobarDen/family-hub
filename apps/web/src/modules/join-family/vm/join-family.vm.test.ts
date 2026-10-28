import { context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { ApiError, InviteAccepted, InvitePreview } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";
import { fakeHaptics } from "@/common/telegram";

import { createJoinFamilyApi } from "../join-family.api.ts";
import { reatomJoinFamily } from "./join-family.vm.ts";

const initData = "query_id=AAH&user=%7B%22id%22%3A222%7D&auth_date=1791100800&hash=abc";
const token = "AbCdEfGhIjKlMnOpQrStUv";

type Reply = InvitePreview | InviteAccepted | { status: number; error: ApiError } | Error;

const open: InvitePreview = { status: "open", inviterName: "Денис", familyName: "Гущины" };

function fakeBackend(replies: { preview: Reply; accept?: Reply }) {
  const requests: unknown[] = [];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    requests.push({
      path: url.pathname,
      body: typeof init.body === "string" ? JSON.parse(init.body) : init.body,
    });

    const reply = url.pathname.endsWith("/accept")
      ? (replies.accept ?? { status: "joined" })
      : replies.preview;

    if (reply instanceof Error) {
      throw reply;
    }

    return "error" in reply
      ? Response.json(reply.error, { status: reply.status })
      : Response.json(reply);
  }

  return { fetch, requests, replies };
}

function refusal(status: number, code: ApiError["code"]): Reply {
  return { status, error: { code, message: "" } };
}

function fakeTelegram(startParameter: string | undefined = `inv_${token}`) {
  const calls: string[] = [];

  return {
    startParam: startParameter as string | undefined,
    initData,
    async requestWriteAccess() {
      calls.push("requestWriteAccess");

      return true;
    },
    haptics: fakeHaptics(),
    calls,
  };
}

function startJoinFamily(backend: ReturnType<typeof fakeBackend>, telegram = fakeTelegram()) {
  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: backend.fetch });
  const onJoined = vi.fn<() => void>();
  const model = reatomJoinFamily({ api: createJoinFamilyApi(client), telegram, onJoined });

  model.load();

  return { model, onJoined };
}

async function settled(model: ReturnType<typeof startJoinFamily>["model"]) {
  await vi.waitFor(() => {
    expect(model.screen().kind).not.toBe("loading");
  });
}

async function join(model: ReturnType<typeof startJoinFamily>["model"]) {
  await settled(model);
  model.join();
  await vi.waitFor(() => {
    expect(model.isJoining()).toBe(false);
  });
}

beforeEach(() => {
  context.reset();
});

describe("opening the app from an Invite", () => {
  test("shows who invites the person into which Family", async () => {
    const backend = fakeBackend({ preview: open });
    const { model } = startJoinFamily(backend);

    await settled(model);

    expect(model.screen()).toEqual({ kind: "invite", inviterName: "Денис", familyName: "Гущины" });
    expect(model.isOpen()).toBe(true);
    expect(backend.requests).toEqual([
      { path: `/api/invites/${token}/preview`, body: { initData } },
    ]);
  });

  test("stays out of the way without an Invite", () => {
    const backend = fakeBackend({ preview: open });
    const { model } = startJoinFamily(backend, { ...fakeTelegram(), startParam: undefined });

    expect(model.isOpen()).toBe(false);
    expect(backend.requests).toEqual([]);
  });

  test("stays out of the way for a link to something else", () => {
    const { model } = startJoinFamily(
      fakeBackend({ preview: open }),
      fakeTelegram("pet_0199b4d2-6c00-7abc-8def-0123456789ab"),
    );

    expect(model.isOpen()).toBe(false);
  });

  test("says a mangled Invite link does not work without asking the server", async () => {
    const backend = fakeBackend({ preview: open });
    const { model } = startJoinFamily(backend, fakeTelegram("inv_short"));

    expect(model.screen()).toEqual({ kind: "unavailable" });
    expect(backend.requests).toEqual([]);
  });

  test("says a used, expired or revoked Invite no longer works", async () => {
    const { model } = startJoinFamily(fakeBackend({ preview: { status: "unavailable" } }));

    await settled(model);

    expect(model.screen()).toEqual({ kind: "unavailable" });
  });

  test("asks a Member of another Family to leave it first", async () => {
    const { model } = startJoinFamily(fakeBackend({ preview: { status: "in-other-family" } }));

    await settled(model);

    expect(model.screen()).toEqual({ kind: "in-other-family" });
  });

  test("lets a Member of this Family straight in", async () => {
    const { model } = startJoinFamily(fakeBackend({ preview: { status: "in-this-family" } }));

    await vi.waitFor(() => {
      expect(model.isOpen()).toBe(false);
    });
  });

  test("offers to try again when the backend cannot be reached", async () => {
    const backend = fakeBackend({ preview: new TypeError("Failed to fetch") });
    const { model } = startJoinFamily(backend);

    await settled(model);
    expect(model.screen()).toEqual({ kind: "failed" });

    backend.replies.preview = open;
    model.load();

    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({ kind: "invite" });
    });
  });

  test("closes on «Продолжить» from a screen that cannot join", async () => {
    const { model } = startJoinFamily(fakeBackend({ preview: { status: "unavailable" } }));

    await settled(model);
    model.close();

    expect(model.isOpen()).toBe(false);
  });
});

describe("joining", () => {
  test("asks for write access, joins and signs in again", async () => {
    const backend = fakeBackend({ preview: open });
    const telegram = fakeTelegram();
    const { model, onJoined } = startJoinFamily(backend, telegram);

    await join(model);

    expect(telegram.calls).toEqual(["requestWriteAccess"]);
    expect(backend.requests).toContainEqual({
      path: `/api/invites/${token}/accept`,
      body: { initData },
    });
    expect(onJoined).toHaveBeenCalledOnce();
    expect(model.isOpen()).toBe(false);
  });

  test("says the Invite no longer works when someone used it first", async () => {
    const { model, onJoined } = startJoinFamily(
      fakeBackend({ preview: open, accept: refusal(410, "INVITE_UNAVAILABLE") }),
    );

    await join(model);

    expect(model.screen()).toEqual({ kind: "unavailable" });
    expect(onJoined).not.toHaveBeenCalled();
  });

  test("signs in again when the person already has a Family", async () => {
    const { model, onJoined } = startJoinFamily(
      fakeBackend({ preview: open, accept: refusal(409, "ALREADY_MEMBER") }),
    );

    await join(model);

    expect(onJoined).toHaveBeenCalledOnce();
    expect(model.isOpen()).toBe(false);
  });

  test("offers to try again when joining fails", async () => {
    const { model, onJoined } = startJoinFamily(
      fakeBackend({ preview: open, accept: new TypeError("Failed to fetch") }),
    );

    await join(model);

    expect(model.screen()).toMatchObject({ kind: "invite" });
    expect(model.failure()).toBe("Не получилось вступить. Попробуйте ещё раз.");
    expect(onJoined).not.toHaveBeenCalled();
  });
});
