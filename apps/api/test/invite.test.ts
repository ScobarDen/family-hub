import type { InlineKeyboardButton, InlineQueryResult, Update } from "@grammyjs/types";
import { describe, expect, test } from "vite-plus/test";

import type { InviteCreated } from "@family-hub/contract";

import { signInitData, tamperUser, type TelegramUserFixture } from "./init-data.ts";
import { asya, startWorker } from "./worker-harness.ts";

const now = "2026-10-04T09:00:00Z";
const operatorId = 1000;
const denis = { id: 111, first_name: "Денис", last_name: "Гущин" };
const vika = { id: 333, first_name: "Вика" };

type Worker = ReturnType<typeof startWorker>;

const json = { "content-type": "application/json" };

function initDataFor(worker: Worker, user: TelegramUserFixture) {
  return signInitData({ botToken: worker.env.BOT_TOKEN, user, authDate: worker.clock.iso() });
}

async function signIn(worker: Worker, user: TelegramUserFixture) {
  const response = await worker.request("/api/session", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ initData: initDataFor(worker, user) }),
  });

  return response.json<{ status: string; token?: string }>();
}

async function sessionOf(worker: Worker, user: TelegramUserFixture): Promise<string> {
  const { token } = await signIn(worker, user);

  if (token === undefined) {
    throw new Error("Not a Member");
  }

  return token;
}

async function startWithFamily() {
  const worker = startWorker({ now });
  const family = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  return { worker, ...family };
}

async function postInvite(worker: Worker, user: TelegramUserFixture) {
  return worker.request("/api/invites", {
    method: "POST",
    headers: { authorization: `Bearer ${await sessionOf(worker, user)}` },
  });
}

async function createInvite(worker: Worker, user: TelegramUserFixture = denis) {
  const response = await postInvite(worker, user);
  const created = await response.json<InviteCreated>();
  const token = new URL(created.link).searchParams.get("startapp")?.replace(/^inv_/, "");

  if (token === undefined) {
    throw new Error("The Invite link carries no token");
  }

  return { ...created, token };
}

async function listInvites(worker: Worker, user: TelegramUserFixture) {
  const response = await worker.request("/api/invites", {
    headers: { authorization: `Bearer ${await sessionOf(worker, user)}` },
  });

  return response.json<Array<{ id: string }>>();
}

async function revoke(worker: Worker, user: TelegramUserFixture, inviteId: string) {
  return worker.request(`/api/invites/${inviteId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${await sessionOf(worker, user)}` },
  });
}

async function postWithInitData(path: string, worker: Worker, initData: string) {
  return worker.request(path, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ initData }),
  });
}

async function preview(worker: Worker, user: TelegramUserFixture, token: string) {
  const response = await postWithInitData(
    `/api/invites/${token}/preview`,
    worker,
    initDataFor(worker, user),
  );

  return response.json();
}

async function accept(worker: Worker, user: TelegramUserFixture, token: string) {
  return postWithInitData(`/api/invites/${token}/accept`, worker, initDataFor(worker, user));
}

async function acceptStatus(worker: Worker, user: TelegramUserFixture, token: string) {
  const response = await accept(worker, user, token);

  return response.status;
}

async function joinByNewInvite(worker: Worker, user: TelegramUserFixture) {
  const { token } = await createInvite(worker);

  await accept(worker, user, token);
}

async function familyOf(worker: Worker, user: TelegramUserFixture) {
  const response = await worker.request("/api/me", {
    headers: { authorization: `Bearer ${await sessionOf(worker, user)}` },
  });
  const me = await response.json<{
    family: { name: string };
    member: { id: string; name: string };
  }>();

  return { family: me.family.name, member: me.member.name, memberId: me.member.id };
}

function buttonsOf(result: InlineQueryResult | undefined): InlineKeyboardButton[] {
  return result?.reply_markup?.inline_keyboard.flat() ?? [];
}

async function submitRequest(worker: Worker, user: TelegramUserFixture) {
  return worker.request("/api/family-requests", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ initData: initDataFor(worker, user), familyName: "Ася и Бьюик" }),
  });
}

async function approve(worker: Worker) {
  const message = worker.bot.sentMessages().find((sent) => sent.chat_id === operatorId);
  const markup = message?.reply_markup;
  const buttons = markup !== undefined && "inline_keyboard" in markup ? markup.inline_keyboard : [];
  const button = buttons.flat().find((candidate) => candidate.text === "✅ Одобрить");
  const update: Update = {
    update_id: 1,
    callback_query: {
      id: "callback-1",
      from: { id: operatorId, is_bot: false, first_name: "Operator" },
      chat_instance: "instance",
      data: button !== undefined && "callback_data" in button ? button.callback_data : "",
      message: {
        message_id: 1,
        date: 0,
        chat: { id: operatorId, type: "private", first_name: "Operator" },
        text: message?.text ?? "",
      },
    },
  };

  await worker.webhook(update);
}

describe("creating an Invite", () => {
  test("gives a single-use Mini App link that lives 7 days", async () => {
    const { worker } = await startWithFamily();

    const response = await postInvite(worker, denis);
    const created = await response.json<InviteCreated>();

    expect(response.status).toBe(201);
    expect(created.link).toMatch(
      /^https:\/\/t\.me\/family_hub_test_bot\?startapp=inv_[A-Za-z0-9_-]{22}$/,
    );
    expect(created.expiresAt).toBe(Date.parse("2026-10-11T09:00:00Z"));
  });

  test("prepares a message for Telegram sharing with a «Вступить» button", async () => {
    const { worker } = await startWithFamily();

    const created = await createInvite(worker);
    const [prepared] = worker.bot.preparedMessages();

    expect(created.preparedMessageId).toMatch(/^prepared-/);
    expect(prepared?.user_id).toBe(denis.id);
    expect(prepared?.result).toMatchObject({
      input_message_content: { message_text: "Денис зовёт вас в семью «Гущины»" },
    });
    expect(buttonsOf(prepared?.result)).toEqual([{ text: "Вступить", url: created.link }]);
  });

  test("still gives the link when Telegram cannot prepare the message", async () => {
    const { worker } = await startWithFamily();

    worker.bot.rateLimitNextCall(5, "savePreparedInlineMessage");
    const response = await postInvite(worker, denis);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ preparedMessageId: null });
  });

  test("needs a session", async () => {
    const { worker } = await startWithFamily();

    const response = await worker.request("/api/invites", { method: "POST" });

    expect(response.status).toBe(401);
  });

  test("lists the Member's own Invites that can still be used", async () => {
    const { worker, familyId } = await startWithFamily();

    await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });
    const kept = await createInvite(worker, denis);
    const used = await createInvite(worker, denis);
    const revoked = await createInvite(worker, denis);

    await createInvite(worker, asya);
    await accept(worker, vika, used.token);
    await revoke(worker, denis, revoked.id);

    expect(await listInvites(worker, denis)).toEqual([
      { id: kept.id, link: kept.link, expiresAt: kept.expiresAt },
    ]);
  });
});

describe("opening an Invite", () => {
  test("shows who invites the person into which Family", async () => {
    const { worker } = await startWithFamily();
    const { token } = await createInvite(worker);

    expect(await preview(worker, asya, token)).toEqual({
      status: "open",
      inviterName: "Денис",
      familyName: "Гущины",
    });
  });

  test("tells a Member of another Family to leave it first", async () => {
    const { worker } = await startWithFamily();
    const { token } = await createInvite(worker);

    await worker.addFamily({ name: "Ивановы", owner: { telegramId: asya.id, name: "Ася" } });

    expect(await preview(worker, asya, token)).toEqual({ status: "in-other-family" });
  });

  test("lets a Member of this Family see they are already in", async () => {
    const { worker } = await startWithFamily();
    const { token } = await createInvite(worker);

    expect(await preview(worker, denis, token)).toEqual({ status: "in-this-family" });
  });

  test("says an unknown Invite does not work", async () => {
    const { worker } = await startWithFamily();

    expect(await preview(worker, asya, "A".repeat(22))).toEqual({ status: "unavailable" });
  });

  test("rejects forged initData", async () => {
    const { worker } = await startWithFamily();
    const { token } = await createInvite(worker);
    const forged = tamperUser(initDataFor(worker, asya), denis);

    const response = await postWithInitData(`/api/invites/${token}/preview`, worker, forged);

    expect(response.status).toBe(401);
  });
});

describe("joining by Invite", () => {
  test("makes the invited person a Member of the Family", async () => {
    const { worker } = await startWithFamily();
    const { token } = await createInvite(worker);

    const response = await accept(worker, asya, token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "joined" });
    expect(await familyOf(worker, asya)).toMatchObject({ family: "Гущины", member: "Ася" });
  });

  test("keeps the Member of someone who once left a Family", async () => {
    const { worker, familyId } = await startWithFamily();
    const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

    await worker.leaveFamily(asyaId);
    await joinByNewInvite(worker, asya);

    expect(await familyOf(worker, asya)).toMatchObject({ family: "Гущины", memberId: asyaId });
  });

  test("works only once", async () => {
    const { worker } = await startWithFamily();
    const { token } = await createInvite(worker);

    await accept(worker, asya, token);
    const second = await accept(worker, vika, token);

    expect(second.status).toBe(410);
    expect(await second.json()).toMatchObject({ code: "INVITE_UNAVAILABLE" });
    expect(await preview(worker, vika, token)).toEqual({ status: "unavailable" });
    expect(await signIn(worker, vika)).toMatchObject({ status: "stranger" });
  });

  test("works until the seventh day is over", async () => {
    const { worker } = await startWithFamily();
    const { token } = await createInvite(worker);

    worker.clock.set("2026-10-11T08:59:59Z");

    expect(await acceptStatus(worker, asya, token)).toBe(200);
  });

  test("stops working after 7 days", async () => {
    const { worker } = await startWithFamily();
    const { token } = await createInvite(worker);

    worker.clock.set("2026-10-11T09:00:00Z");

    expect(await preview(worker, asya, token)).toEqual({ status: "unavailable" });
    expect(await acceptStatus(worker, asya, token)).toBe(410);
  });

  test("refuses a Member of another Family and leaves the Invite for someone else", async () => {
    const { worker } = await startWithFamily();
    const { token } = await createInvite(worker);

    await worker.addFamily({ name: "Ивановы", owner: { telegramId: asya.id, name: "Ася" } });
    const refused = await accept(worker, asya, token);

    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ code: "ALREADY_MEMBER" });
    expect(await familyOf(worker, asya)).toMatchObject({ family: "Ивановы" });
    expect(await acceptStatus(worker, vika, token)).toBe(200);
  });
});

describe("revoking an Invite", () => {
  test("stops the link from working", async () => {
    const { worker } = await startWithFamily();
    const { id, token } = await createInvite(worker);

    const response = await revoke(worker, denis, id);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "revoked" });
    expect(await preview(worker, asya, token)).toEqual({ status: "unavailable" });
    expect(await acceptStatus(worker, asya, token)).toBe(410);
  });

  test("is only for the Member who created the Invite", async () => {
    const { worker, familyId } = await startWithFamily();
    const { id, token } = await createInvite(worker);

    await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });
    const response = await revoke(worker, asya, id);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "INVITE_NOT_FOUND" });
    expect(await acceptStatus(worker, vika, token)).toBe(200);
  });

  test("cannot reach an Invite of another Family", async () => {
    const { worker } = await startWithFamily();
    const { id } = await createInvite(worker);

    await worker.addFamily({ name: "Ивановы", owner: { telegramId: asya.id, name: "Ася" } });

    const response = await revoke(worker, asya, id);

    expect(response.status).toBe(404);
  });
});

describe("a pending Family Request of the invited person", () => {
  test("is cancelled by joining, and the Operator's ✅ says it is no longer relevant", async () => {
    const { worker } = await startWithFamily();

    await submitRequest(worker, asya);
    await joinByNewInvite(worker, asya);
    await approve(worker);

    expect(await signIn(worker, asya)).toMatchObject({ status: "member" });
    expect(worker.bot.editedMessages().at(-1)?.text).toMatch(/Уже неактуально$/);
    expect(worker.bot.sentMessages().filter((sent) => sent.chat_id === asya.id)).toEqual([]);
  });

  test("no longer waits, so a Member who leaves can ask for a Family again", async () => {
    const { worker } = await startWithFamily();

    await submitRequest(worker, asya);
    await joinByNewInvite(worker, asya);
    const { memberId } = await familyOf(worker, asya);

    await worker.leaveFamily(memberId);
    const response = await submitRequest(worker, asya);

    expect(response.status).toBe(201);
  });
});
