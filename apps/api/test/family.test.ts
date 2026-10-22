import { describe, expect, test } from "vite-plus/test";

import type { FamilyMemberList, InviteCreated } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const now = "2026-10-04T09:00:00Z";
const denis = { id: 111, first_name: "Денис" };
const asya = { id: 222, first_name: "Ася" };
const vika = { id: 333, first_name: "Вика" };

type Worker = ReturnType<typeof startWorker>;

async function signIn(worker: Worker, user: TelegramUserFixture) {
  const response = await worker.request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initData: signInitData({ botToken: worker.env.BOT_TOKEN, user, authDate: now }),
    }),
  });

  return response.json<{ status: string; token?: string }>();
}

async function call(
  worker: Worker,
  user: TelegramUserFixture,
  { method, path, body }: { method: string; path: string; body?: unknown },
) {
  const { token = "" } = await signIn(worker, user);

  return worker.request(path, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function membersSeenBy(worker: Worker, user: TelegramUserFixture) {
  const response = await call(worker, user, { method: "GET", path: "/api/family/members" });

  return response.json<FamilyMemberList>();
}

async function leave(worker: Worker, user: TelegramUserFixture) {
  return call(worker, user, { method: "POST", path: "/api/family/leave" });
}

async function remove(worker: Worker, user: TelegramUserFixture, memberId: string) {
  return call(worker, user, { method: "DELETE", path: `/api/family/members/${memberId}` });
}

async function handOver(worker: Worker, user: TelegramUserFixture, memberId: string) {
  return call(worker, user, { method: "PUT", path: "/api/family/owner", body: { memberId } });
}

async function deleteFamily(worker: Worker, user: TelegramUserFixture, familyName: string) {
  return call(worker, user, { method: "DELETE", path: "/api/family", body: { familyName } });
}

async function startWithFamily() {
  const worker = startWorker({ now });
  const { familyId, ownerId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });
  const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  return { worker, familyId, denisId: ownerId, asyaId };
}

async function inviteBy(worker: Worker, user: TelegramUserFixture) {
  const response = await call(worker, user, { method: "POST", path: "/api/invites" });
  const { link } = await response.json<InviteCreated>();

  return new URL(link).searchParams.get("startapp")?.replace(/^inv_/, "") ?? "";
}

async function previewStatus(worker: Worker, user: TelegramUserFixture, token: string) {
  const response = await worker.request(`/api/invites/${token}/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initData: signInitData({ botToken: worker.env.BOT_TOKEN, user, authDate: now }),
    }),
  });
  const { status } = await response.json<{ status: string }>();

  return status;
}

describe("a Member leaving", () => {
  test("is gone from the Family and signs in as a stranger next time", async () => {
    const { worker } = await startWithFamily();

    const response = await leave(worker, asya);

    expect(await response.json()).toEqual({ status: "left" });
    expect(await membersSeenBy(worker, denis)).toEqual([
      expect.objectContaining({ name: "Денис" }),
    ]);
    expect(await signIn(worker, asya)).toMatchObject({ status: "stranger" });
  });

  test("takes their open Invites with them", async () => {
    const { worker } = await startWithFamily();
    const token = await inviteBy(worker, asya);

    await leave(worker, asya);

    expect(await previewStatus(worker, vika, token)).toBe("unavailable");
  });

  test("leaves the other Members' Invites open", async () => {
    const { worker } = await startWithFamily();
    const token = await inviteBy(worker, denis);

    await leave(worker, asya);

    expect(await previewStatus(worker, vika, token)).toBe("open");
  });

  test("ends the session they had", async () => {
    const { worker } = await startWithFamily();
    const { token } = await signIn(worker, asya);

    await leave(worker, asya);

    const response = await worker.request("/api/me", {
      headers: { authorization: `Bearer ${token ?? ""}` },
    });

    expect(response.status).toBe(401);
  });
});

describe("the Family Owner leaving", () => {
  test("is refused while other Members remain", async () => {
    const { worker } = await startWithFamily();

    const response = await leave(worker, denis);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "OWNER_MUST_HAND_OVER" });
    expect(await membersSeenBy(worker, asya)).toHaveLength(2);
  });

  test("goes through once the role is handed over", async () => {
    const { worker, asyaId } = await startWithFamily();

    await handOver(worker, denis, asyaId);
    const response = await leave(worker, denis);

    expect(await response.json()).toEqual({ status: "left" });
    expect(await membersSeenBy(worker, asya)).toEqual([
      { id: asyaId, name: "Ася", isFamilyOwner: true },
    ]);
  });

  test("deletes the Family when they are its only Member", async () => {
    const { worker } = await startWithFamily();

    await leave(worker, asya);
    const response = await leave(worker, denis);

    expect(await response.json()).toEqual({ status: "family-deleted" });
    expect(await signIn(worker, denis)).toMatchObject({ status: "stranger" });
  });
});

describe("removing a Member", () => {
  test("takes them out of the Family and tells them through the bot", async () => {
    const { worker, asyaId } = await startWithFamily();

    const response = await remove(worker, denis, asyaId);

    expect(await response.json()).toEqual({ status: "removed" });
    expect(await membersSeenBy(worker, denis)).toHaveLength(1);
    expect(worker.bot.sentMessages()).toEqual([
      { chat_id: asya.id, text: "Вас исключили из семьи «Гущины»." },
    ]);
  });

  test("takes the removed Member's open Invites with them", async () => {
    const { worker, asyaId } = await startWithFamily();
    const token = await inviteBy(worker, asya);

    await remove(worker, denis, asyaId);

    expect(await previewStatus(worker, vika, token)).toBe("unavailable");
  });

  test("goes through when the removed Member blocked the bot", async () => {
    const { worker, asyaId } = await startWithFamily();

    worker.bot.blockChat(asya.id);
    const response = await remove(worker, denis, asyaId);

    expect(response.status).toBe(200);
    expect(await membersSeenBy(worker, denis)).toHaveLength(1);
  });

  test("is refused to a Member who is not the Family Owner", async () => {
    const { worker, denisId } = await startWithFamily();

    const response = await remove(worker, asya, denisId);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "NOT_FAMILY_OWNER" });
    expect(await membersSeenBy(worker, denis)).toHaveLength(2);
  });

  test("cannot reach a Member of another Family", async () => {
    const { worker } = await startWithFamily();
    const { ownerId: vikaId } = await worker.addFamily({
      name: "Соседи",
      owner: { telegramId: vika.id, name: "Вика" },
    });

    const response = await remove(worker, denis, vikaId);

    expect(response.status).toBe(404);
    expect(await membersSeenBy(worker, vika)).toHaveLength(1);
  });

  test("does not let the Family Owner remove themselves", async () => {
    const { worker, denisId } = await startWithFamily();

    const response = await remove(worker, denis, denisId);

    expect(response.status).toBe(404);
  });
});

describe("handing over the Owner role", () => {
  test("makes the other Member the Family Owner and tells them through the bot", async () => {
    const { worker, denisId, asyaId } = await startWithFamily();

    const response = await handOver(worker, denis, asyaId);

    expect(await response.json()).toEqual({ status: "handed-over" });
    expect(await membersSeenBy(worker, denis)).toEqual([
      { id: asyaId, name: "Ася", isFamilyOwner: true },
      { id: denisId, name: "Денис", isFamilyOwner: false },
    ]);
    expect(worker.bot.sentMessages()).toEqual([
      {
        chat_id: asya.id,
        text: "Денис передаёт вам роль владельца семьи «Гущины». Теперь приглашать, исключать и удалять семью можете вы.",
      },
    ]);
  });

  test("leaves the former Owner without the Owner's rights", async () => {
    const { worker, denisId, asyaId } = await startWithFamily();

    await handOver(worker, denis, asyaId);
    const response = await handOver(worker, denis, denisId);

    expect(response.status).toBe(403);
  });

  test("is refused to a Member who is not the Family Owner", async () => {
    const { worker, asyaId } = await startWithFamily();

    const response = await handOver(worker, asya, asyaId);

    expect(response.status).toBe(403);
    expect(worker.bot.sentMessages()).toEqual([]);
  });

  test("cannot go to a Member of another Family", async () => {
    const { worker } = await startWithFamily();
    const { ownerId: vikaId } = await worker.addFamily({
      name: "Соседи",
      owner: { telegramId: vika.id, name: "Вика" },
    });

    const response = await handOver(worker, denis, vikaId);

    expect(response.status).toBe(404);
    expect(await membersSeenBy(worker, denis)).toContainEqual(
      expect.objectContaining({ name: "Денис", isFamilyOwner: true }),
    );
  });
});

describe("deleting the Family", () => {
  test("removes everything of the Family once its name is typed", async () => {
    const { worker } = await startWithFamily();

    const token = await inviteBy(worker, asya);
    const response = await deleteFamily(worker, denis, " Гущины ");

    expect(await response.json()).toEqual({ status: "deleted" });
    expect(await previewStatus(worker, vika, token)).toBe("unavailable");
    expect(await signIn(worker, asya)).toMatchObject({ status: "stranger" });
    expect(await signIn(worker, denis)).toMatchObject({ status: "stranger" });
  });

  test("is refused when the typed name differs", async () => {
    const { worker } = await startWithFamily();

    const response = await deleteFamily(worker, denis, "гущины");

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "FAMILY_NAME_MISMATCH" });
    expect(await membersSeenBy(worker, denis)).toHaveLength(2);
  });

  test("is refused to a Member who is not the Family Owner", async () => {
    const { worker } = await startWithFamily();

    const response = await deleteFamily(worker, asya, "Гущины");

    expect(response.status).toBe(403);
    expect(await membersSeenBy(worker, denis)).toHaveLength(2);
  });

  test("leaves other Families alone", async () => {
    const { worker } = await startWithFamily();

    await worker.addFamily({ name: "Соседи", owner: { telegramId: vika.id, name: "Вика" } });
    await deleteFamily(worker, denis, "Гущины");

    expect(await membersSeenBy(worker, vika)).toHaveLength(1);
  });
});
