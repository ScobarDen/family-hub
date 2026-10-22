import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { Invite, InviteCreated, InviteList } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import { createInvitesApi } from "../invites.api.ts";
import { reatomInvites } from "./invites.vm.ts";

const link = "https://t.me/family_hub_bot?startapp=inv_AbCdEfGhIjKlMnOpQrStUv";
const expiresAt = Date.parse("2026-10-11T09:00:00Z");

const older: Invite = {
  id: "invite-1",
  link: "https://t.me/family_hub_bot?startapp=inv_ZyXwVuTsRqPoNmLkJiHgFe",
  expiresAt: Date.parse("2026-10-09T12:00:00Z"),
};
const created: InviteCreated = { id: "invite-2", link, expiresAt, preparedMessageId: "prepared-1" };

type Reply = InviteList | InviteCreated | { status: "revoked" } | number | Error;

function fakeBackend({
  list = [older],
  create = created,
  revoke = { status: "revoked" },
}: { list?: Reply; create?: Reply; revoke?: Reply } = {}) {
  const requests: string[] = [];
  const replies: Record<string, Reply> = { GET: list, POST: create, DELETE: revoke };

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const method = init.method ?? "GET";
    const reply = replies[method] ?? 404;

    requests.push(`${method} ${url.pathname}`);

    if (reply instanceof Error) {
      throw reply;
    }

    return typeof reply === "number"
      ? Response.json({ code: "INVITE_NOT_FOUND", message: "" }, { status: reply })
      : Response.json(reply, { status: method === "POST" ? 201 : 200 });
  }

  return { fetch, requests };
}

function fakeTelegram({ canShareMessage = true } = {}) {
  const calls: string[] = [];

  return {
    canShareMessage,
    async shareMessage(preparedMessageId: string) {
      calls.push(`shareMessage ${preparedMessageId}`);

      return true;
    },
    openTelegramLink(url: string) {
      calls.push(`openTelegramLink ${url}`);
    },
    calls,
  };
}

function startInvites(backend = fakeBackend(), telegram = fakeTelegram()) {
  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: backend.fetch });
  const model = reatomInvites({
    api: createInvitesApi(client),
    telegram,
    timeZone: () => "Europe/Moscow",
  });

  model.invites.subscribe(noop);

  return model;
}

async function loaded(model: ReturnType<typeof startInvites>) {
  await vi.waitFor(() => {
    expect(model.isLoading()).toBe(false);
  });
}

async function invite(model: ReturnType<typeof startInvites>) {
  await loaded(model);
  model.invite();
  await vi.waitFor(() => {
    expect(model.isInviting()).toBe(false);
  });
}

beforeEach(() => {
  context.reset();
});

describe("the Member's Invites", () => {
  test("lists the open ones with the day each one stops working", async () => {
    const model = startInvites();

    await loaded(model);

    expect(model.invites()).toEqual([{ id: "invite-1", title: "Приглашение до 9 октября" }]);
  });
});

describe("inviting", () => {
  test("creates an Invite and shares the prepared message through Telegram", async () => {
    const backend = fakeBackend();
    const telegram = fakeTelegram();
    const model = startInvites(backend, telegram);

    await invite(model);

    expect(backend.requests).toContain("POST /api/invites");
    expect(telegram.calls).toEqual(["shareMessage prepared-1"]);
    expect(model.invites()).toEqual([
      { id: "invite-2", title: "Приглашение до 11 октября" },
      { id: "invite-1", title: "Приглашение до 9 октября" },
    ]);
  });

  test("shares the bare link where Telegram cannot share a prepared message", async () => {
    const telegram = fakeTelegram({ canShareMessage: false });
    const model = startInvites(fakeBackend(), telegram);

    await invite(model);

    expect(telegram.calls).toEqual([
      `openTelegramLink https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Присоединяйтесь к нашей семье в Family Hub")}`,
    ]);
  });

  test("shares the bare link when the bot could not prepare a message", async () => {
    const telegram = fakeTelegram();
    const model = startInvites(
      fakeBackend({ create: { ...created, preparedMessageId: null } }),
      telegram,
    );

    await invite(model);

    expect(telegram.calls).toEqual([
      expect.stringMatching(/^openTelegramLink https:\/\/t\.me\/share\/url\?/),
    ]);
  });

  test("offers to try again when the Invite cannot be created", async () => {
    const telegram = fakeTelegram();
    const model = startInvites(fakeBackend({ create: new TypeError("Failed to fetch") }), telegram);

    await invite(model);

    expect(model.failure()).toBe("Не получилось создать приглашение. Попробуйте ещё раз.");
    expect(telegram.calls).toEqual([]);
    expect(model.invites()).toHaveLength(1);
  });
});

describe("revoking", () => {
  test("removes the Invite at once", async () => {
    const backend = fakeBackend();
    const model = startInvites(backend);

    await loaded(model);
    model.revoke("invite-1");

    expect(model.invites()).toEqual([]);
    await vi.waitFor(() => {
      expect(backend.requests).toContain("DELETE /api/invites/invite-1");
    });
  });

  test("puts the Invite back when revoking fails", async () => {
    const model = startInvites(fakeBackend({ revoke: new TypeError("Failed to fetch") }));

    await loaded(model);
    model.revoke("invite-1");

    await vi.waitFor(() => {
      expect(model.invites()).toEqual([{ id: "invite-1", title: "Приглашение до 9 октября" }]);
    });
    expect(model.failure()).toBe("Не получилось отозвать приглашение. Попробуйте ещё раз.");
  });

  test("keeps it removed when it was already gone on the server", async () => {
    const model = startInvites(fakeBackend({ revoke: 404 }));

    await loaded(model);
    model.revoke("invite-1");
    await vi.waitFor(() => {
      expect(model.isRevoking()).toBe(false);
    });

    expect(model.invites()).toEqual([]);
    expect(model.failure()).toBeUndefined();
  });
});
