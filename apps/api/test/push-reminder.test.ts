import { describe, expect, test } from "vite-plus/test";

import type { LoginSession, ReminderChannel, Task, TaskChange } from "@family-hub/contract";

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

async function signInDevice(worker: Worker): Promise<LoginSession> {
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

  return response.json<LoginSession>();
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
  return worker.push
    .pushes()
    .filter(({ message }) => message.startParam?.startsWith("task_") === true);
}

function pressTokenOf(worker: Worker): string {
  const token = taskPushes(worker).at(-1)?.message.pressToken;

  if (token === undefined) {
    throw new Error("No Push with buttons arrived");
  }

  return token;
}

async function pressPush(worker: Worker, body: { token: string; action: "done" | "snooze" }) {
  return worker.request("/api/reminders/press", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function remindWeekly(worker: Worker, title: string): Promise<Task> {
  const change: TaskChange = {
    title,
    when: { date: "2026-10-02", ...dateOnly },
    recurrence: { frequency: "weekly", until: null },
    reminderOffsets: ["at-start"],
  };
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/tasks",
    body: change,
  });

  return response.json<Task>();
}

async function completionsOf(worker: Worker, id: string): Promise<Array<string | null>> {
  const response = await request(worker, denis, { method: "GET", path: "/api/tasks" });
  const tasks = await response.json<Task[]>();
  const task = tasks.find((candidate) => candidate.id === id);

  return task?.completions.map(({ occurrence }) => occurrence) ?? [];
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

  test("deleted gets no more Push", async () => {
    const worker = await startWithFamily();
    const deleted = await subscribe(worker, phone);

    await subscribe(worker, laptop);
    await worker.request(`/api/devices/${deleted.device.id}/push`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${deleted.token}` },
    });
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(taskPushes(worker).map(({ endpoint }) => endpoint)).toEqual([laptop]);
  });

  test("gone with its revoked Device gets no more Push", async () => {
    const worker = await startWithFamily();
    const revoked = await subscribe(worker, phone);

    await subscribe(worker, laptop);
    await worker.request(`/api/devices/${revoked.device.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${revoked.token}` },
    });
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(taskPushes(worker).map(({ endpoint }) => endpoint)).toEqual([laptop]);
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
        message: {
          title: "Вынести мусор",
          body: "Сегодня · Дела",
          tag: expect.any(String),
          startParam: `task_${task.id}`,
          pressToken: expect.any(String),
        },
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
    worker.push.answer(phone, "gone");
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");
    worker.push.answer(phone, "accepted");
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
    worker.push.answer(phone, "refused");
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(botTexts(worker)).toHaveLength(1);
  });

  test("under «push» falls back to the bot when the push service fails, keeping the subscription", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    await chooseChannel(worker, "push");
    worker.push.answer(phone, "refused");
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");
    worker.push.answer(phone, "accepted");
    await remindTomorrow(worker, "Полить цветы");
    await tickAt(worker, "2026-10-02T06:01:00Z");

    expect(botTexts(worker)).toEqual(["📌 Вынести мусор · 2 октября"]);
    expect(taskPushes(worker).map(({ message }) => message.title)).toEqual(["Полить цветы"]);
  });
});

describe("a Push", () => {
  test("of a Reminder replaces its earlier Push when it comes again after «Отложить»", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    await chooseChannel(worker, "push");
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");
    await pressPush(worker, { token: pressTokenOf(worker), action: "snooze" });
    await tickAt(worker, "2026-10-03T06:00:00Z");

    const [first, again] = taskPushes(worker);

    expect(again?.message.title).toBe("Вынести мусор");
    expect(again?.message.tag).toBe(first?.message.tag);
  });

  test("names the Pet of a Pet-linked Task and says tomorrow for a Reminder a day ahead", async () => {
    const worker = await startWithFamily();
    const pet = await request(worker, denis, {
      method: "POST",
      path: "/api/pets",
      body: {
        name: "Бьюик",
        species: "dog",
        breed: null,
        sex: null,
        birthDate: null,
        chipNumber: null,
        notes: null,
      },
    });
    const { id: petId } = await pet.json<{ id: string }>();

    await subscribe(worker, phone);
    await request(worker, denis, {
      method: "POST",
      path: "/api/tasks",
      body: {
        title: "Привить",
        when: { date: "2026-10-03", ...dateOnly },
        petId,
        reminderOffsets: ["1d"],
      } satisfies TaskChange,
    });
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(taskPushes(worker).map(({ message }) => message.body)).toEqual(["Завтра · Бьюик"]);
  });

  test("«Готово» completes the Occurrence it showed and closes the bot's message under «both»", async () => {
    const worker = await startWithFamily();
    const task = await remindTomorrow(worker, "Вынести мусор");

    await subscribe(worker, phone);
    await tickAt(worker, "2026-10-02T06:00:00Z");

    const response = await pressPush(worker, { token: pressTokenOf(worker), action: "done" });

    expect(response.status).toBe(204);
    expect(await completionsOf(worker, task.id)).toHaveLength(1);
    expect(worker.bot.editedMessages().map(({ text }) => text)).toEqual([
      "✅ Сделал(а) Денис: Вынести мусор · 2 октября",
    ]);
  });

  test("«Готово» under «push» completes the shown Occurrence, not the next one the row moved to", async () => {
    const worker = await startWithFamily();
    const task = await remindWeekly(worker, "Полить цветы");

    await subscribe(worker, phone);
    await chooseChannel(worker, "push");
    await tickAt(worker, "2026-10-02T06:00:00Z");
    await pressPush(worker, { token: pressTokenOf(worker), action: "done" });

    expect(await completionsOf(worker, task.id)).toEqual(["2026-10-02"]);
  });

  test("«Готово» pressed twice says it is already done", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    await remindWeekly(worker, "Полить цветы");
    await tickAt(worker, "2026-10-02T06:00:00Z");
    await pressPush(worker, { token: pressTokenOf(worker), action: "done" });

    const again = await pressPush(worker, { token: pressTokenOf(worker), action: "done" });

    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ code: "PRESS_REFUSED", message: "Уже сделано" });
  });

  test("«Готово» pressed twice on a single Task says it is already done", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");
    await pressPush(worker, { token: pressTokenOf(worker), action: "done" });

    const again = await pressPush(worker, { token: pressTokenOf(worker), action: "done" });

    expect(await again.json()).toEqual({ code: "PRESS_REFUSED", message: "Уже сделано" });
  });

  test("«Отложить» after «Готово» does not bring a pushed birthday back", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    await chooseChannel(worker, "push");
    await request(worker, denis, {
      method: "POST",
      path: "/api/pets",
      body: {
        name: "Бьюик",
        species: "dog",
        breed: null,
        sex: null,
        birthDate: "2020-10-02",
        chipNumber: null,
        notes: null,
      },
    });
    await tickAt(worker, "2026-10-02T06:00:00Z");

    const birthday = worker.push.pushes().find(({ message }) => message.title.startsWith("🎂"));
    const token = birthday?.message.pressToken ?? "";

    await pressPush(worker, { token, action: "done" });
    const snoozed = await pressPush(worker, { token, action: "snooze" });

    await tickAt(worker, "2026-10-02T07:00:00Z");

    expect(await snoozed.json()).toEqual({ code: "PRESS_REFUSED", message: "Уже сделано" });
    expect(
      worker.push.pushes().filter(({ message }) => message.title.startsWith("🎂")),
    ).toHaveLength(1);
  });

  test("buttons stop working once their Device is revoked", async () => {
    const worker = await startWithFamily();
    const { token, device } = await subscribe(worker, phone);

    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");
    const pressToken = pressTokenOf(worker);

    await worker.request(`/api/devices/${device.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });

    const response = await pressPush(worker, { token: pressToken, action: "done" });

    expect(response.status).toBe(409);
  });

  test("buttons with a forged token do nothing", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");
    const [claims = ""] = pressTokenOf(worker).split(".");

    const response = await pressPush(worker, { token: `${claims}.forged`, action: "done" });

    expect(response.status).toBe(409);
  });

  test("of the digest comes without buttons", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");

    const digest = worker.push.pushes().find(({ message }) => message.title.startsWith("☀️"));

    expect(digest?.message.pressToken).toBeUndefined();
    expect(digest?.message.body).toContain("Вынести мусор");
  });
});

describe("a replaced subscription", () => {
  test("is saved by its old endpoint without a session", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    const response = await worker.request("/api/push/rotation", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ oldEndpoint: phone, subscription: subscriptionOf(laptop) }),
    });

    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(response.status).toBe(200);
    expect(taskPushes(worker).map(({ endpoint }) => endpoint)).toEqual([laptop]);
  });

  test("is refused for an endpoint the Worker does not know", async () => {
    const worker = await startWithFamily();

    const response = await worker.request("/api/push/rotation", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ oldEndpoint: phone, subscription: subscriptionOf(laptop) }),
    });

    expect(response.status).toBe(404);
  });
});

describe("the subscription a Device holds", () => {
  test("is told by its endpoint, or null once the push service called it gone", async () => {
    const worker = await startWithFamily();
    const { token, device } = await subscribe(worker, phone);

    async function endpointOf() {
      const response = await worker.request(`/api/devices/${device.id}/push`, {
        headers: { authorization: `Bearer ${token}` },
      });

      return response.json();
    }

    const before = await endpointOf();

    worker.push.answer(phone, "gone");
    await remindTomorrow(worker, "Вынести мусор");
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(before).toEqual({ endpoint: phone });
    expect(await endpointOf()).toEqual({ endpoint: null });
  });

  test("goes with its Device once the Device is unused for 90 days", async () => {
    const worker = await startWithFamily();

    await subscribe(worker, phone);
    await tickAt(worker, "2026-12-31T03:00:00Z");

    const left = await worker.env.DB.prepare(
      "SELECT count(*) AS count FROM push_subscriptions",
    ).first<{ count: number }>();

    expect(left?.count).toBe(0);
  });
});
