import { atom, context } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { ApiError, FamilyRequestCreated, FamilyRequestStatus } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import { createFamilyRequestApi } from "../family-request.api.ts";
import { reatomFamilyRequest } from "./family-request.vm.ts";

const initData = "query_id=AAH&user=%7B%22id%22%3A111%7D&auth_date=1791100800&hash=abc";

type Reply = FamilyRequestCreated | { status: number; error: ApiError } | Error;

function fakeBackend(reply: Reply) {
  const requests: unknown[] = [];

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    requests.push({
      path: url.pathname,
      body: typeof init.body === "string" ? JSON.parse(init.body) : init.body,
    });

    if (reply instanceof Error) {
      throw reply;
    }

    return "error" in reply
      ? Response.json(reply.error, { status: reply.status })
      : Response.json(reply, { status: 201 });
  }

  return { fetch, requests };
}

function refusal(status: number, code: ApiError["code"]): Reply {
  return { status, error: { code, message: "" } };
}

function fakeTelegram({ allowsWriteAccess = true } = {}) {
  const calls: string[] = [];

  return {
    initData,
    async requestWriteAccess() {
      calls.push("requestWriteAccess");

      return allowsWriteAccess;
    },
    calls,
  };
}

type StartOptions = {
  telegram?: ReturnType<typeof fakeTelegram>;
  knownStatus?: FamilyRequestStatus;
};

function startFamilyRequest(
  backend: ReturnType<typeof fakeBackend>,
  { telegram = fakeTelegram(), knownStatus = "none" }: StartOptions = {},
) {
  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: backend.fetch });
  const navigation = { back: vi.fn<() => void>(), check: vi.fn<() => void>() };
  const familyRequestStatus = atom<FamilyRequestStatus | undefined>(
    knownStatus,
    "test.familyRequestStatus",
  );
  const model = reatomFamilyRequest({
    api: createFamilyRequestApi(client),
    telegram,
    familyRequestStatus,
    onBack: navigation.back,
    onCheck: navigation.check,
  });

  return { model, navigation, familyRequestStatus };
}

async function submit(model: ReturnType<typeof startFamilyRequest>["model"], familyName: string) {
  model.form.fields.familyName.set(familyName);
  model.submit();
  await vi.waitFor(() => {
    expect(model.isSubmitting()).toBe(false);
  });
}

beforeEach(() => {
  context.reset();
});

describe("submitting a Family Request", () => {
  test("starts on the form", () => {
    const { model } = startFamilyRequest(fakeBackend({ status: "pending" }));

    expect(model.screen()).toEqual({ kind: "form" });
  });

  test("asks Telegram for write access before sending the request", async () => {
    const backend = fakeBackend({ status: "pending" });
    const telegram = fakeTelegram();
    const { model } = startFamilyRequest(backend, { telegram });

    await submit(model, "  Гущины ");

    expect(telegram.calls).toEqual(["requestWriteAccess"]);
    expect(backend.requests).toEqual([
      { path: "/api/family-requests", body: { initData, familyName: "Гущины" } },
    ]);
    expect(model.screen()).toEqual({ kind: "sent" });
  });

  test("sends the request even when write access is denied", async () => {
    const backend = fakeBackend({ status: "pending" });
    const { model } = startFamilyRequest(backend, {
      telegram: fakeTelegram({ allowsWriteAccess: false }),
    });

    await submit(model, "Гущины");

    expect(model.screen()).toEqual({ kind: "sent" });
  });

  test("asks for a family name instead of sending an empty one", async () => {
    const backend = fakeBackend({ status: "pending" });
    const { model } = startFamilyRequest(backend);

    await submit(model, "   ");

    expect(backend.requests).toEqual([]);
    expect(model.screen()).toEqual({ kind: "form" });
    expect(model.form.fields.familyName.validation().error).toBe("Введите название семьи");
  });

  test("refuses a family name longer than 64 characters", async () => {
    const backend = fakeBackend({ status: "pending" });
    const { model } = startFamilyRequest(backend);

    await submit(model, "Б".repeat(65));

    expect(backend.requests).toEqual([]);
    expect(model.form.fields.familyName.validation().error).toBe("Не длиннее 64 символов");
  });
});

describe("a refused Family Request", () => {
  test("says a request is already waiting for approval", async () => {
    const { model } = startFamilyRequest(fakeBackend(refusal(409, "FAMILY_REQUEST_PENDING")));

    await submit(model, "Гущины");

    expect(model.screen()).toEqual({ kind: "already-pending" });
  });

  test("says a new request can be sent only 7 days after a rejection", async () => {
    const { model } = startFamilyRequest(fakeBackend(refusal(429, "FAMILY_REQUEST_COOLDOWN")));

    await submit(model, "Гущины");

    expect(model.screen()).toEqual({ kind: "cooldown" });
  });

  test("signs in again when the requester already has a Family", async () => {
    const { model, navigation } = startFamilyRequest(fakeBackend(refusal(409, "ALREADY_MEMBER")));

    await submit(model, "Гущины");

    expect(navigation.check).toHaveBeenCalledOnce();
  });

  test("offers to try again when the Operator cannot be reached", async () => {
    const { model } = startFamilyRequest(fakeBackend(refusal(503, "OPERATOR_UNAVAILABLE")));

    await submit(model, "Гущины");

    expect(model.screen()).toEqual({ kind: "form" });
    expect(model.failure()).toBe("Не получилось отправить заявку. Попробуйте ещё раз.");
  });

  test("offers to try again when the backend cannot be reached", async () => {
    const { model } = startFamilyRequest(fakeBackend(new TypeError("Failed to fetch")));

    await submit(model, "Гущины");

    expect(model.failure()).toBe("Не получилось отправить заявку. Попробуйте ещё раз.");
  });

  test("shows no failure before anything is sent", () => {
    const { model } = startFamilyRequest(fakeBackend({ status: "pending" }));

    expect(model.failure()).toBeUndefined();
  });
});

describe("a Family Request the server already knows about", () => {
  test("opens on the waiting screen while the request is pending", () => {
    const { model } = startFamilyRequest(fakeBackend({ status: "pending" }), {
      knownStatus: "pending",
    });

    expect(model.screen()).toEqual({ kind: "already-pending" });
  });

  test("opens on the cooldown instead of a form that would be refused", () => {
    const { model } = startFamilyRequest(fakeBackend({ status: "pending" }), {
      knownStatus: "cooldown",
    });

    expect(model.screen()).toEqual({ kind: "cooldown" });
  });

  test("keeps saying the request was sent while it waits", async () => {
    const { model, familyRequestStatus } = startFamilyRequest(fakeBackend({ status: "pending" }));

    await submit(model, "Гущины");
    familyRequestStatus.set("pending");

    expect(model.screen()).toEqual({ kind: "sent" });
  });

  test("shows the cooldown once a check finds the request rejected", async () => {
    const { model, familyRequestStatus } = startFamilyRequest(fakeBackend({ status: "pending" }));

    await submit(model, "Гущины");
    familyRequestStatus.set("cooldown");

    expect(model.screen()).toEqual({ kind: "cooldown" });
  });
});

describe("after sending", () => {
  test("checks whether the Family is created by signing in again", async () => {
    const { model, navigation } = startFamilyRequest(fakeBackend({ status: "pending" }));

    await submit(model, "Гущины");
    model.check();

    expect(navigation.check).toHaveBeenCalledOnce();
  });

  test("goes back to the stranger screen", () => {
    const { model, navigation } = startFamilyRequest(fakeBackend({ status: "pending" }));

    model.back();

    expect(navigation.back).toHaveBeenCalledOnce();
  });
});
