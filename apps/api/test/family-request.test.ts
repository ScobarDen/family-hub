import type { Update } from "@grammyjs/types";
import { describe, expect, test } from "vite-plus/test";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const now = "2026-10-04T09:00:00Z";
const operatorId = 1000;
const denis = { id: 111, first_name: "Денис", last_name: "Гущин", username: "scobar" };
const asya = { id: 222, first_name: "Ася" };

type Worker = ReturnType<typeof startWorker>;

function initDataFor(worker: Worker, user: TelegramUserFixture) {
  return signInitData({ botToken: worker.env.BOT_TOKEN, user, authDate: worker.clock.iso() });
}

async function submitRequest(worker: Worker, user: TelegramUserFixture, familyName = "Гущины") {
  return worker.request("/api/family-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData: initDataFor(worker, user), familyName }),
  });
}

async function signIn(worker: Worker, user: TelegramUserFixture) {
  const response = await worker.request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData: initDataFor(worker, user) }),
  });

  return response.json<{ status: string; token?: string }>();
}

function operatorMessage(worker: Worker) {
  const message = worker.bot.sentMessages().find((sent) => sent.chat_id === operatorId);

  if (!message) {
    throw new Error("The Operator got no Family Request");
  }

  return message;
}

function buttonData(worker: Worker, text: string): string {
  const markup = operatorMessage(worker).reply_markup;
  const keyboard =
    markup !== undefined && "inline_keyboard" in markup ? markup.inline_keyboard : [];
  const button = keyboard.flat().find((candidate) => candidate.text === text);

  if (!button || !("callback_data" in button)) {
    throw new Error(`No «${text}» button on the Family Request`);
  }

  return button.callback_data;
}

let nextUpdateId = 1;

function press(worker: Worker, text: "✅ Одобрить" | "❌ Отклонить", fromId = operatorId) {
  nextUpdateId += 1;

  const update: Update = {
    update_id: nextUpdateId,
    callback_query: {
      id: `callback-${nextUpdateId}`,
      from: { id: fromId, is_bot: false, first_name: "Operator" },
      chat_instance: "instance",
      data: buttonData(worker, text),
      message: {
        message_id: 1,
        date: 0,
        chat: { id: operatorId, type: "private", first_name: "Operator" },
        text: operatorMessage(worker).text,
      },
    },
  };

  return worker.webhook(update);
}

function messagesTo(worker: Worker, chatId: number): string[] {
  return worker.bot
    .sentMessages()
    .filter((message) => message.chat_id === chatId)
    .map((message) => message.text);
}

describe("submitting a Family Request", () => {
  test("sends the Operator the family name, the requester and ✅ / ❌ buttons", async () => {
    const worker = startWorker({ now });

    const response = await submitRequest(worker, denis);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "pending" });
    expect(operatorMessage(worker).text).toBe(
      "Новая заявка на семью\n\nСемья: Гущины\nОт: Денис Гущин (@scobar)",
    );
    expect(buttonData(worker, "✅ Одобрить")).toMatch(/^fr:approve:/);
    expect(buttonData(worker, "❌ Отклонить")).toMatch(/^fr:reject:/);
  });

  test("shows a requester without a username by name only", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, asya, "Ася и Бьюик");

    expect(operatorMessage(worker).text).toBe(
      "Новая заявка на семью\n\nСемья: Ася и Бьюик\nОт: Ася",
    );
  });

  test("creates nothing until the Operator approves", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, denis);

    expect(await worker.rowCounts()).toEqual({ members: 0, families: 0, familyMembers: 0 });
    expect(await signIn(worker, denis)).toEqual({ status: "stranger" });
  });

  test("is refused while another request from the same account is pending", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, denis);
    const response = await submitRequest(worker, denis, "Другая семья");

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "FAMILY_REQUEST_PENDING" });
    expect(messagesTo(worker, operatorId)).toHaveLength(1);
  });

  test("is refused to a Member who already has a Family", async () => {
    const worker = startWorker({ now });

    await worker.addFamily({ name: "Гущины", owner: { telegramId: denis.id, name: "Денис" } });
    const response = await submitRequest(worker, denis, "Вторая семья");

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ALREADY_MEMBER" });
    expect(worker.bot.sentMessages()).toEqual([]);
  });

  test("is refused without a family name", async () => {
    const worker = startWorker({ now });

    const response = await submitRequest(worker, denis, "   ");

    expect(response.status).toBe(400);
    expect(worker.bot.sentMessages()).toEqual([]);
  });

  test("is refused with forged initData", async () => {
    const worker = startWorker({ now });
    const forged = signInitData({ botToken: "other-bot-token", user: denis, authDate: now });

    const response = await worker.request("/api/family-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: forged, familyName: "Гущины" }),
    });

    expect(response.status).toBe(401);
    expect(worker.bot.sentMessages()).toEqual([]);
  });

  test("is not kept when the Operator cannot be reached", async () => {
    const worker = startWorker({ now });

    worker.bot.blockChat(operatorId);
    const failed = await submitRequest(worker, denis);

    worker.bot.unblockChat(operatorId);
    const retried = await submitRequest(worker, denis);

    expect(failed.status).toBe(503);
    expect(retried.status).toBe(201);
  });
});

describe("the Operator approves", () => {
  test("creates the Family with the requester as its Family Owner", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, denis);
    await press(worker, "✅ Одобрить");

    const session = await signIn(worker, denis);
    const me = await worker.request("/api/me", {
      headers: { authorization: `Bearer ${session.token}` },
    });

    expect(session.status).toBe("member");
    expect(await me.json()).toMatchObject({
      member: { name: "Денис Гущин" },
      family: { name: "Гущины" },
      isFamilyOwner: true,
    });
  });

  test("tells the requester the Family is created", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, denis);
    await press(worker, "✅ Одобрить");

    expect(messagesTo(worker, denis.id)).toEqual([
      "Семья «Гущины» создана 🎉\n\nОткройте Family Hub — вы её Family Owner.",
    ]);
  });

  test("marks the request decided in the Operator's chat and answers the button", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, denis);
    await press(worker, "✅ Одобрить");

    expect(worker.bot.editedMessages()).toEqual([
      {
        chat_id: operatorId,
        message_id: 1,
        text: "Новая заявка на семью\n\nСемья: Гущины\nОт: Денис Гущин (@scobar)\n\n✅ Одобрено",
      },
    ]);
    expect(worker.bot.answeredCallbacks()).toEqual([{ callback_query_id: expect.any(String) }]);
  });

  test("keeps the Family when the requester has blocked the bot", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, denis);
    worker.bot.blockChat(denis.id);
    const response = await press(worker, "✅ Одобрить");

    expect(response.status).toBe(200);
    expect(await signIn(worker, denis)).toMatchObject({ status: "member" });
  });

  test("gives the Operator no access to the new Family", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, denis);
    await press(worker, "✅ Одобрить");

    expect(await signIn(worker, { id: operatorId, first_name: "Operator" })).toEqual({
      status: "stranger",
    });
    expect(await worker.rowCounts()).toEqual({ members: 1, families: 1, familyMembers: 1 });
  });

  test("a second press changes nothing", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, denis);
    await press(worker, "✅ Одобрить");
    await press(worker, "✅ Одобрить");
    await press(worker, "❌ Отклонить");

    expect(await worker.rowCounts()).toEqual({ members: 1, families: 1, familyMembers: 1 });
    expect(messagesTo(worker, denis.id)).toHaveLength(1);
    expect(worker.bot.answeredCallbacks().at(-1)).toMatchObject({
      text: "Заявка уже рассмотрена",
    });
  });

  test("marks the request no longer relevant when the requester has joined a Family meanwhile", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, asya, "Ася и Бьюик");
    const { familyId } = await worker.addFamily({
      name: "Гущины",
      owner: { telegramId: denis.id, name: "Денис" },
    });

    await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });
    await press(worker, "✅ Одобрить");

    expect(await worker.rowCounts()).toEqual({ members: 2, families: 1, familyMembers: 2 });
    expect(worker.bot.editedMessages().at(-1)?.text).toMatch(/Уже неактуально$/);
    expect(messagesTo(worker, asya.id)).toEqual([]);
  });

  test("reuses the Member of a requester who once left a Family", async () => {
    const worker = startWorker({ now });
    const { familyId } = await worker.addFamily({
      name: "Гущины",
      owner: { telegramId: denis.id, name: "Денис" },
    });
    const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

    await worker.leaveFamily(asyaId);
    await submitRequest(worker, asya, "Ася и Бьюик");
    await press(worker, "✅ Одобрить");

    expect(await signIn(worker, asya)).toMatchObject({ status: "member" });
    expect(await worker.rowCounts()).toEqual({ members: 2, families: 2, familyMembers: 2 });
  });
});

describe("the Operator rejects", () => {
  test("politely tells the requester and creates nothing", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, denis);
    await press(worker, "❌ Отклонить");

    expect(messagesTo(worker, denis.id)).toEqual([
      "К сожалению, заявку на семью «Гущины» не одобрили.\n\nОтправить новую можно через 7 дней.",
    ]);
    expect(worker.bot.editedMessages().at(-1)?.text).toMatch(/❌ Отклонено$/);
    expect(await worker.rowCounts()).toEqual({ members: 0, families: 0, familyMembers: 0 });
  });

  test("lets the requester try again only after 7 days", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, denis);
    await press(worker, "❌ Отклонить");

    worker.clock.set("2026-10-11T08:59:00Z");
    const tooEarly = await submitRequest(worker, denis);

    worker.clock.set("2026-10-11T09:00:00Z");
    const afterCooldown = await submitRequest(worker, denis);

    expect(tooEarly.status).toBe(429);
    expect(await tooEarly.json()).toMatchObject({ code: "FAMILY_REQUEST_COOLDOWN" });
    expect(afterCooldown.status).toBe(201);
  });
});

describe("a press by anyone but the Operator", () => {
  test("is refused and changes nothing", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, denis);
    await press(worker, "✅ Одобрить", denis.id);
    await press(worker, "❌ Отклонить", asya.id);

    expect(await worker.rowCounts()).toEqual({ members: 0, families: 0, familyMembers: 0 });
    expect(messagesTo(worker, denis.id)).toEqual([]);
    expect(worker.bot.editedMessages()).toEqual([]);
    expect(worker.bot.answeredCallbacks()).toEqual([
      expect.objectContaining({ text: "Это может сделать только Operator" }),
      expect.objectContaining({ text: "Это может сделать только Operator" }),
    ]);
  });

  test("leaves the request for the Operator to decide", async () => {
    const worker = startWorker({ now });

    await submitRequest(worker, denis);
    await press(worker, "✅ Одобрить", denis.id);
    await press(worker, "✅ Одобрить");

    expect(await signIn(worker, denis)).toMatchObject({ status: "member" });
  });
});
