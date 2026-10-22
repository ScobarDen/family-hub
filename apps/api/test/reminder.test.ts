import type { InlineKeyboardMarkup, Update } from "@grammyjs/types";
import { describe, expect, test } from "vite-plus/test";

import type { Reminder, ReminderChange } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const denis = { id: 111, first_name: "Денис" };
const asya = { id: 222, first_name: "Ася" };
const vika = { id: 333, first_name: "Вика" };

const internet: ReminderChange = {
  text: "Оплатить интернет",
  start: { date: "2026-10-04", time: "13:00", timeZone: "Europe/Moscow" },
  recurrence: { frequency: "weekly", until: null },
  visibility: "shared",
  recipientIds: null,
};

const firesAt = "2026-10-04T10:00:00Z";

async function request(
  worker: ReturnType<typeof startWorker>,
  user: TelegramUserFixture,
  { method = "GET", path, body }: { method?: string; path: string; body?: unknown },
) {
  const session = await worker.request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initData: signInitData({
        botToken: worker.env.BOT_TOKEN,
        user,
        authDate: worker.clock.iso(),
      }),
    }),
  });
  const { token = "" } = await session.json<{ token?: string }>();

  return worker.request(path, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function startWithFamily() {
  const worker = startWorker({ now: "2026-10-04T09:00:00Z" });
  const { familyId, ownerId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });
  const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  return Object.assign(worker, { denisId: ownerId, asyaId });
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

async function createReminder(worker: Worker, change: Partial<ReminderChange> = {}) {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/reminders",
    body: { ...internet, ...change },
  });

  return response.json<Reminder>();
}

function messagesTo(worker: Worker, user: TelegramUserFixture) {
  return worker.bot.sentMessages().filter(({ chat_id: chatId }) => chatId === user.id);
}

function lastCallbackOf(worker: Worker, user: TelegramUserFixture, action: "done" | "snooze") {
  const markup = messagesTo(worker, user).at(-1)?.reply_markup as InlineKeyboardMarkup | undefined;
  const button = markup?.inline_keyboard
    .flat()
    .find((candidate) =>
      "callback_data" in candidate ? candidate.callback_data?.includes(`:${action}:`) : false,
    );

  return button !== undefined && "callback_data" in button ? (button.callback_data ?? "") : "";
}

async function press(worker: Worker, user: TelegramUserFixture, data: string) {
  const update: Update = {
    update_id: 1,
    callback_query: {
      id: `callback-${user.id}`,
      from: { ...user, is_bot: false },
      chat_instance: "instance",
      data,
    },
  };

  await worker.webhook(update);
}

describe("delivering a Reminder", () => {
  test("waits for its moment and then reaches every Member with its buttons", async () => {
    const worker = await startWithFamily();

    await createReminder(worker);
    worker.clock.set("2026-10-04T09:59:00Z");
    await worker.tick();

    expect(worker.bot.sentMessages()).toEqual([]);

    worker.clock.set(firesAt);
    await worker.tick();

    expect(messagesTo(worker, denis)).toEqual([
      expect.objectContaining({ text: "🔔 Оплатить интернет" }),
    ]);
    expect(messagesTo(worker, asya)).toHaveLength(1);
    expect(lastCallbackOf(worker, asya, "done")).toMatch(/^rd:done:/);
  });

  test("comes back with its next Occurrence", async () => {
    const worker = await startWithFamily();

    await createReminder(worker);
    worker.clock.set(firesAt);
    await worker.tick();
    await worker.tick();
    worker.clock.set("2026-10-11T10:00:00Z");
    await worker.tick();

    expect(messagesTo(worker, denis)).toHaveLength(2);
  });

  test("goes only to the chosen Recipients, and a Private one only to its owner", async () => {
    const worker = await startWithFamily();

    await createReminder(worker, { recipientIds: [worker.asyaId] });
    await createReminder(worker, { text: "Подарок", visibility: "private" });
    worker.clock.set(firesAt);
    await worker.tick();

    expect(messagesTo(worker, asya).map(({ text }) => text)).toEqual(["🔔 Оплатить интернет"]);
    expect(messagesTo(worker, denis).map(({ text }) => text)).toEqual(["🔔 Подарок"]);
  });

  test("refuses another Member as Recipient of a Private Reminder", async () => {
    const worker = await startWithFamily();

    const response = await request(worker, denis, {
      method: "POST",
      path: "/api/reminders",
      body: { ...internet, visibility: "private", recipientIds: [worker.asyaId] },
    });

    expect(response.status).toBe(400);
  });

  test("is sent once when two ticks run together", async () => {
    const worker = await startWithFamily();

    await createReminder(worker);
    worker.clock.set(firesAt);
    await Promise.all([worker.tick(), worker.tick()]);

    expect(messagesTo(worker, denis)).toHaveLength(1);
    expect(messagesTo(worker, asya)).toHaveLength(1);
  });

  test("skips an Occurrence more than 12 hours late and keeps the next one", async () => {
    const worker = await startWithFamily();

    await createReminder(worker);
    worker.clock.set("2026-10-04T22:01:00Z");
    await worker.tick();

    expect(worker.bot.sentMessages()).toEqual([]);

    worker.clock.set("2026-10-11T10:00:00Z");
    await worker.tick();

    expect(messagesTo(worker, denis)).toHaveLength(1);
  });
});

describe("the bot's limits", () => {
  test("a garbled answer for one row lets the rest go and tries that row again", async () => {
    const worker = await startWithFamily();

    await createReminder(worker);
    worker.clock.set(firesAt);
    worker.bot.breakNextCall();
    await worker.tick();

    expect(worker.bot.sentMessages()).toHaveLength(1);

    worker.clock.set("2026-10-04T10:01:01Z");
    await worker.tick();

    expect(worker.bot.sentMessages()).toHaveLength(2);
  });

  test("a 429 leaves the rows for the next tick", async () => {
    const worker = await startWithFamily();

    await createReminder(worker);
    worker.clock.set(firesAt);
    worker.bot.rateLimitNextCall(5, "sendMessage");
    await worker.tick();

    expect(worker.bot.sentMessages()).toEqual([]);

    worker.clock.set("2026-10-04T10:01:00Z");
    await worker.tick();

    expect(worker.bot.sentMessages()).toHaveLength(2);
  });

  test("a 403 marks the Member unreachable until they write /start", async () => {
    const worker = await startWithFamily();

    await createReminder(worker);
    worker.bot.blockChat(denis.id);
    worker.clock.set(firesAt);
    await worker.tick();
    worker.bot.unblockChat(denis.id);
    worker.clock.set("2026-10-11T10:00:00Z");
    await worker.tick();

    expect(messagesTo(worker, asya)).toHaveLength(2);
    expect(messagesTo(worker, denis)).toEqual([]);

    await worker.webhook({
      update_id: 2,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: denis.id, type: "private", first_name: "Денис" },
        from: { ...denis, is_bot: false },
        text: "/start",
      },
    });
    worker.clock.set("2026-10-18T10:00:00Z");
    await worker.tick();

    expect(messagesTo(worker, denis)).toHaveLength(1);
  });
});

describe("the Reminder buttons", () => {
  test("«Готово» closes the Occurrence for everyone and marks every message with who did it", async () => {
    const worker = await startWithFamily();

    await createReminder(worker);
    worker.clock.set(firesAt);
    await worker.tick();
    await press(worker, asya, lastCallbackOf(worker, asya, "done"));

    const edits = worker.bot.editedMessages().map(({ chat_id: chatId, text }) => [chatId, text]);

    expect(edits.toSorted((left, right) => Number(left[0]) - Number(right[0]))).toEqual([
      [denis.id, "✅ Сделал(а) Ася: Оплатить интернет"],
      [asya.id, "✅ Сделал(а) Ася: Оплатить интернет"],
    ]);
    expect(worker.bot.answeredCallbacks()).toEqual([{ callback_query_id: `callback-${asya.id}` }]);
  });

  test("«Отложить» brings back only the presser's own Reminder an hour later", async () => {
    const worker = await startWithFamily();

    await createReminder(worker);
    worker.clock.set(firesAt);
    await worker.tick();
    await press(worker, denis, lastCallbackOf(worker, denis, "snooze"));

    expect(worker.bot.editedMessages()).toEqual([
      expect.objectContaining({
        chat_id: denis.id,
        text: "⏰ Отложено до 14:00: Оплатить интернет",
      }),
    ]);

    worker.clock.set("2026-10-04T10:59:00Z");
    await worker.tick();
    worker.clock.set("2026-10-04T11:00:00Z");
    await worker.tick();

    expect(messagesTo(worker, denis)).toHaveLength(2);
    expect(messagesTo(worker, asya)).toHaveLength(1);
  });

  test("still work on a sent message after the Reminder is edited", async () => {
    const worker = await startWithFamily();
    const reminder = await createReminder(worker);

    worker.clock.set(firesAt);
    await worker.tick();
    await press(worker, denis, lastCallbackOf(worker, denis, "snooze"));
    await request(worker, denis, {
      method: "PUT",
      path: `/api/reminders/${reminder.id}`,
      body: { ...internet, text: "Оплатить интернет и ТВ" },
    });
    await press(worker, asya, lastCallbackOf(worker, asya, "done"));

    const edits = worker.bot.editedMessages().map(({ chat_id: chatId, text }) => [chatId, text]);

    expect(edits).toContainEqual([asya.id, "✅ Сделал(а) Ася: Оплатить интернет и ТВ"]);
    expect(edits).toContainEqual([denis.id, "✅ Сделал(а) Ася: Оплатить интернет и ТВ"]);
  });

  test("keep a snooze through an edit of the Reminder", async () => {
    const worker = await startWithFamily();
    const reminder = await createReminder(worker);

    worker.clock.set(firesAt);
    await worker.tick();
    await press(worker, denis, lastCallbackOf(worker, denis, "snooze"));
    worker.clock.set("2026-10-04T10:30:00Z");
    await request(worker, denis, {
      method: "PUT",
      path: `/api/reminders/${reminder.id}`,
      body: { ...internet, text: "Оплатить интернет и ТВ" },
    });
    worker.clock.set("2026-10-04T11:00:00Z");
    await worker.tick();

    expect(messagesTo(worker, denis).map(({ text }) => text)).toEqual([
      "🔔 Оплатить интернет",
      "🔔 Оплатить интернет и ТВ",
    ]);
    expect(messagesTo(worker, asya)).toHaveLength(1);
  });

  test("answer someone else's press with «это не ваше напоминание» and change nothing", async () => {
    const worker = await startWithFamily();

    await worker.addFamily({ name: "Соседи", owner: { telegramId: vika.id, name: "Вика" } });
    await createReminder(worker);
    worker.clock.set(firesAt);
    await worker.tick();
    await press(worker, asya, lastCallbackOf(worker, denis, "done"));
    await press(worker, vika, lastCallbackOf(worker, denis, "snooze"));

    expect(worker.bot.editedMessages()).toEqual([]);
    expect(worker.bot.answeredCallbacks().map(({ text }) => text)).toEqual([
      "Это не ваше напоминание",
      "Это не ваше напоминание",
    ]);
  });
});

describe("housekeeping at 03:00 UTC", () => {
  test("drops Invites nobody used that expired", async () => {
    const worker = await startWithFamily();

    await request(worker, denis, { method: "POST", path: "/api/invites" });
    worker.clock.set("2026-10-20T03:00:00Z");
    await worker.tick();

    expect(await worker.countInvites()).toBe(0);
  });

  test("leaves Invites alone at other times", async () => {
    const worker = await startWithFamily();

    await request(worker, denis, { method: "POST", path: "/api/invites" });
    worker.clock.set("2026-10-20T03:01:00Z");
    await worker.tick();

    expect(await worker.countInvites()).toBe(1);
  });
});
