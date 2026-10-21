import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { ApiError, FamilyMemberList } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";
import type { PopupParams } from "@/common/telegram";

import { createFamilyApi } from "../family.api.ts";
import { reatomFamily } from "./family.vm.ts";

const members: FamilyMemberList = [
  { id: "member-1", name: "Денис", isFamilyOwner: true },
  { id: "member-2", name: "Ася", isFamilyOwner: false },
];

function fakeBackend(replies: Record<string, unknown> = {}) {
  const requests: string[] = [];
  const answers: Record<string, unknown> = {
    "GET /api/family/members": members,
    "POST /api/family/leave": { status: "left" },
    "DELETE /api/family/members/member-2": { status: "removed" },
    "PUT /api/family/owner": { status: "handed-over" },
    "DELETE /api/family": { status: "deleted" },
    ...replies,
  };

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}`;
    const reply = answers[request];

    requests.push(typeof init.body === "string" ? `${request} ${init.body}` : request);

    if (reply instanceof Error) {
      throw reply;
    }

    return typeof reply === "number"
      ? Response.json({ code: "INVALID_REQUEST", message: "" } satisfies ApiError, {
          status: reply,
        })
      : Response.json(reply);
  }

  return { fetch, requests };
}

function fakeTelegram(choices: string[] = []) {
  const calls: string[] = [];
  const pending = [...choices];

  return {
    showAlert(message: string) {
      calls.push(`showAlert ${message}`);
    },
    async showPopup({ title }: PopupParams) {
      calls.push(`showPopup ${title ?? ""}`);

      return pending.shift();
    },
    calls,
  };
}

function startFamily({
  backend = fakeBackend(),
  telegram = fakeTelegram(),
  memberId = "member-1",
}: {
  backend?: ReturnType<typeof fakeBackend>;
  telegram?: ReturnType<typeof fakeTelegram>;
  memberId?: string;
} = {}) {
  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: backend.fetch });
  const onLeft = vi.fn<() => void>();
  const model = reatomFamily({
    api: createFamilyApi(client),
    telegram,
    self: () => ({ memberId, familyName: "Гущины" }),
    onLeft,
  });

  model.members.subscribe(noop);

  return { model, backend, telegram, onLeft };
}

type Model = ReturnType<typeof startFamily>["model"];

async function loaded(model: Model) {
  await vi.waitFor(() => {
    expect(model.members()).not.toEqual([]);
  });
}

async function settled(model: Model) {
  await vi.waitFor(() => {
    expect(model.isBusy()).toBe(false);
  });
}

beforeEach(() => {
  context.reset();
});

describe("the Family's Members in the Profile", () => {
  test("lists everyone and marks the Family Owner", async () => {
    const { model } = startFamily();

    await vi.waitFor(() => {
      expect(model.members()).toEqual([
        {
          id: "member-1",
          name: "Денис",
          isFamilyOwner: true,
          role: "Владелец",
          isManageable: false,
        },
        { id: "member-2", name: "Ася", isFamilyOwner: false, role: undefined, isManageable: true },
      ]);
    });
  });

  test("lets only the Family Owner manage the others", async () => {
    const { model } = startFamily({ memberId: "member-2" });

    await loaded(model);

    expect(model.members().map(({ isManageable }) => isManageable)).toEqual([false, false]);
    expect(model.canDeleteFamily()).toBe(false);
  });

  test("says so when the list cannot load", async () => {
    const { model } = startFamily({
      backend: fakeBackend({ "GET /api/family/members": new TypeError("Failed to fetch") }),
    });

    await vi.waitFor(() => {
      expect(model.loadFailure()).toBe("Не получилось загрузить участников.");
    });
  });
});

describe("removing a Member", () => {
  test("drops them from the list once the Family Owner confirms", async () => {
    const { model, backend } = startFamily({ telegram: fakeTelegram(["remove", "confirm"]) });

    await loaded(model);
    model.manage("member-2");
    await settled(model);

    expect(backend.requests).toContain("DELETE /api/family/members/member-2");
    expect(model.members().map(({ name }) => name)).toEqual(["Денис"]);
  });

  test("does nothing when the confirmation is dismissed", async () => {
    const { model, backend } = startFamily({ telegram: fakeTelegram(["remove"]) });

    await loaded(model);
    model.manage("member-2");
    await settled(model);

    expect(backend.requests).not.toContain("DELETE /api/family/members/member-2");
    expect(model.members()).toHaveLength(2);
  });

  test("keeps the Member and says so when the server fails", async () => {
    const { model } = startFamily({
      backend: fakeBackend({ "DELETE /api/family/members/member-2": 503 }),
      telegram: fakeTelegram(["remove", "confirm"]),
    });

    await loaded(model);
    model.manage("member-2");
    await settled(model);

    expect(model.members()).toHaveLength(2);
    expect(model.failure()).toBe("Не получилось исключить участника. Попробуйте ещё раз.");
  });
});

describe("handing over the Owner role", () => {
  test("moves the Owner mark and takes the management away", async () => {
    const { model, backend } = startFamily({ telegram: fakeTelegram(["hand-over", "confirm"]) });

    await loaded(model);
    model.manage("member-2");
    await settled(model);

    expect(backend.requests).toContain('PUT /api/family/owner {"memberId":"member-2"}');
    expect(model.members()).toEqual([
      expect.objectContaining({ name: "Денис", role: undefined, isManageable: false }),
      expect.objectContaining({ name: "Ася", role: "Владелец", isManageable: false }),
    ]);
    expect(model.canDeleteFamily()).toBe(false);
  });
});

describe("leaving the Family", () => {
  test("signs the Member out of it after the confirmation", async () => {
    const { model, backend, onLeft } = startFamily({
      memberId: "member-2",
      telegram: fakeTelegram(["confirm"]),
    });

    await loaded(model);
    model.leave();
    await settled(model);

    expect(backend.requests).toContain("POST /api/family/leave");
    expect(onLeft).toHaveBeenCalledOnce();
  });

  test("stays put when the confirmation is dismissed", async () => {
    const { model, onLeft } = startFamily({ memberId: "member-2" });

    await loaded(model);
    model.leave();
    await settled(model);

    expect(onLeft).not.toHaveBeenCalled();
  });

  test("asks the Family Owner among others to hand the role over first", async () => {
    const { model, backend, telegram } = startFamily();

    await loaded(model);
    model.leave();
    await settled(model);

    expect(telegram.calls).toEqual([
      "showAlert Сначала передайте роль владельца: нажмите на участника в списке.",
    ]);
    expect(backend.requests).not.toContain("POST /api/family/leave");
  });

  test("opens the deletion for the Family Owner who is its only Member", async () => {
    const { model } = startFamily({
      backend: fakeBackend({ "GET /api/family/members": members.slice(0, 1) }),
    });

    await loaded(model);
    model.leave();

    await vi.waitFor(() => {
      expect(model.isDeletionOpen()).toBe(true);
    });
  });
});

describe("deleting the Family", () => {
  test("goes through once the Family's name is typed", async () => {
    const { model, backend, onLeft } = startFamily();

    await loaded(model);
    model.openDeletion();
    model.deletion.fields.familyName.set("Гущины");
    model.deleteFamily();

    await vi.waitFor(() => {
      expect(onLeft).toHaveBeenCalledOnce();
    });
    expect(backend.requests).toContain('DELETE /api/family {"familyName":"Гущины"}');
  });

  test("is refused while the typed name differs", async () => {
    const { model, backend, onLeft } = startFamily();

    await loaded(model);
    model.openDeletion();
    model.deletion.fields.familyName.set("Гущ");
    model.deleteFamily();

    await vi.waitFor(() => {
      expect(model.deletion.fields.familyName.validation().error).toBe("Название не совпадает");
    });
    expect(backend.requests).not.toContain('DELETE /api/family {"familyName":"Гущ"}');
    expect(onLeft).not.toHaveBeenCalled();
  });

  test("says so when the server fails", async () => {
    const { model, onLeft } = startFamily({ backend: fakeBackend({ "DELETE /api/family": 503 }) });

    await loaded(model);
    model.openDeletion();
    model.deletion.fields.familyName.set("Гущины");
    model.deleteFamily();

    await vi.waitFor(() => {
      expect(model.deletionFailure()).toBe("Не получилось удалить семью. Попробуйте ещё раз.");
    });
    expect(onLeft).not.toHaveBeenCalled();
  });
});
