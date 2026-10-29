import { describe, expect, test } from "vite-plus/test";

import type { DeviceSignIn, ReminderChannel, Task, TaskChange } from "@family-hub/contract";

import { signTelegramLogin } from "./init-data.ts";
import { denis, request, startWorker } from "./worker-harness.ts";

const dateOnly = { time: null, timeZone: null, endDate: null, endTime: null };

async function startWithFamily() {
  const worker = startWorker({ now: "2026-10-01T09:00:00Z" });
  const family = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  await request(worker, denis, {
    method: "PUT",
    path: "/api/me/time-zone",
    body: { timeZone: "Europe/Moscow", isAuto: true },
  });

  return Object.assign(worker, family);
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

async function signInDevice(worker: Worker): Promise<DeviceSignIn> {
  const response = await worker.request("/api/session/telegram-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      signTelegramLogin({
        botToken: worker.env.BOT_TOKEN,
        user: denis,
        authDate: worker.clock.iso(),
      }),
    ),
  });

  return response.json<DeviceSignIn>();
}

function subscriptionOf(endpoint: string) {
  return {
    endpoint,
    keys: {
      p256dh:
        "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
      auth: "BTBZMqHH6r4Tts7J_aSIgg",
    },
  };
}

async function subscribe(worker: Worker, endpoint: string) {
  const { token, device } = await signInDevice(worker);

  const response = await worker.request(`/api/devices/${device.id}/push`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(subscriptionOf(endpoint)),
  });

  return { response, token, device };
}

async function chooseChannel(worker: Worker, channel: ReminderChannel) {
  return request(worker, denis, {
    method: "PUT",
    path: "/api/me/reminder-channel",
    body: { channel },
  });
}

async function remindTomorrow(worker: Worker, title: string): Promise<Task> {
  const change: TaskChange = {
    title,
    when: { date: "2026-10-02", ...dateOnly },
    reminderOffsets: ["at-start"],
  };
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/tasks",
    body: change,
  });

  return response.json<Task>();
}

async function tickAt(worker: Worker, moment: string) {
  worker.clock.set(moment);
  await worker.tick();
}

function botTexts(worker: Worker) {
  return worker.bot
    .sentMessages()
    .filter(({ chat_id: chatId, text }) => chatId === denis.id && text.startsWith("📌"))
    .map(({ text }) => text);
}

// The morning digest comes at the same 09:00; only the Task's Reminder is looked at.
function taskPushes(worker: Worker) {
  return worker.push.pushes().filter(({ message }) => message.text.startsWith("📌"));
}

const phone = "https://fcm.googleapis.com/fcm/send/phone";
const laptop = "https://fcm.googleapis.com/fcm/send/laptop";

describe("a push subscription", () => {
  test("is saved for the Member's own Device and replaced by the next one", async () => {
    const worker = await startWithFamily();
    const { token, device } = await subscribe(worker, phone);

    await worker.request(`/api/devices/${device.id}/push`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(subscriptionOf(laptop)),
    });
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(taskPushes(worker).map(({ endpoint }) => endpoint)).toEqual([laptop]);
  });

  test("is refused for a Device that is not the Member's", async () => {
    const worker = await startWithFamily();

    const response = await request(worker, denis, {
      method: "PUT",
      path: "/api/devices/someone-elses/push",
      body: subscriptionOf(phone),
    });

    expect(response.status).toBe(404);
  });

  test("is refused for an endpoint that is no browser's push service", async () => {
    const worker = await startWithFamily();

    const { response } = await subscribe(worker, "https://internal.example.net/hook");

    expect(response.status).toBe(400);
  });

  test("deleted, or gone with its revoked Device, gets no more Push", async () => {
    const worker = await startWithFamily();
    const first = await subscribe(worker, phone);
    const second = await subscribe(worker, laptop);

    await worker.request(`/api/devices/${first.device.id}/push`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${first.token}` },
    });
    await worker.request(`/api/devices/${second.device.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${second.token}` },
    });
    await chooseChannel(worker, "push");
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(taskPushes(worker)).toEqual([]);
    expect(botTexts(worker)).toEqual(["📌 Вынести мусор · 2 октября"]);
  });
});

describe("a Reminder", () => {
  test("goes to both the bot and Push by default, saying the same and opening the Task", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    const task = await remindTomorrow(worker, "Вынести мусор");

    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(botTexts(worker)).toEqual(["📌 Вынести мусор · 2 октября"]);
    expect(taskPushes(worker)).toEqual([
      {
        endpoint: phone,
        message: { text: "📌 Вынести мусор · 2 октября", startParam: `task_${task.id}` },
      },
    ]);
  });

  test("under «telegram» goes only to the bot", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    await chooseChannel(worker, "telegram");
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(botTexts(worker)).toHaveLength(1);
    expect(taskPushes(worker)).toEqual([]);
  });

  test("under «push» goes only to Push, on every Device", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    await subscribe(worker, laptop);
    await chooseChannel(worker, "push");
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(botTexts(worker)).toEqual([]);
    expect(
      taskPushes(worker)
        .map(({ endpoint }) => endpoint)
        .toSorted(),
    ).toEqual([laptop, phone]);
  });

  test("under «push» with no subscription falls back to the bot", async () => {
    const worker = await startWithFamily();

    await chooseChannel(worker, "push");
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(botTexts(worker)).toEqual(["📌 Вынести мусор · 2 октября"]);
  });

  test("drops a subscription the push service calls gone, and the next one goes to the bot", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    await chooseChannel(worker, "push");
    worker.push.answer(phone, 410);
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");
    worker.push.answer(phone, 201);
    await remindTomorrow(worker, "Полить цветы");
    await tickAt(worker, "2026-10-02T06:01:00Z");

    expect(taskPushes(worker)).toEqual([]);
    expect(botTexts(worker)).toEqual([
      "📌 Вынести мусор · 2 октября",
      "📌 Полить цветы · 2 октября",
    ]);
  });

  test("still pushes when the bot is blocked", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    worker.bot.blockChat(denis.id);
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(taskPushes(worker)).toHaveLength(1);
  });

  test("still goes to the bot when Push fails", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    worker.push.answer(phone, 500);
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(botTexts(worker)).toHaveLength(1);
  });

  test("under «push» falls back to the bot when the push service fails, keeping the subscription", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    await chooseChannel(worker, "push");
    worker.push.answer(phone, 500);
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");
    worker.push.answer(phone, 201);
    await remindTomorrow(worker, "Полить цветы");
    await tickAt(worker, "2026-10-02T06:01:00Z");

    expect(botTexts(worker)).toEqual(["📌 Вынести мусор · 2 октября"]);
    expect(taskPushes(worker).map(({ message }) => message.text)).toEqual([
      "📌 Полить цветы · 2 октября",
    ]);
  });
});
