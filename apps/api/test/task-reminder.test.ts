import type { InlineKeyboardMarkup, Update } from "@grammyjs/types";
import { describe, expect, test } from "vite-plus/test";

import type { Task, TaskChange, TaskList } from "@family-hub/contract";

import { type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker } from "./worker-harness.ts";

async function bodyOf<Body>(response: Promise<Response>): Promise<Body> {
  const settled = await response;

  return settled.json<Body>();
}

async function startWithFamily() {
  const worker = startWorker({ now: "2026-10-01T09:00:00Z" });
  const { familyId, ownerId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });
  const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  for (const user of [denis, asya]) {
    await request(worker, user, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: user === denis ? "Europe/Moscow" : "Asia/Vladivostok", isAuto: true },
    });
  }

  return Object.assign(worker, { denisId: ownerId, asyaId });
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

const dateOnly = { time: null, timeZone: null, endDate: null, endTime: null };

async function createTask(worker: Worker, change: TaskChange): Promise<Task> {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/tasks",
    body: change,
  });

  return response.json<Task>();
}

async function addBuick(worker: Worker): Promise<string> {
  const response = await request(worker, denis, {
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

  const { id } = await response.json<{ id: string }>();

  return id;
}

function messagesTo(worker: Worker, user: TelegramUserFixture) {
  return worker.bot
    .sentMessages()
    .filter(({ chat_id: chatId, text }) => chatId === user.id && /^[📌🐾]/u.test(text));
}

function textsTo(worker: Worker, user: TelegramUserFixture) {
  return messagesTo(worker, user).map(({ text }) => text);
}

function buttonsOf(worker: Worker, user: TelegramUserFixture) {
  const markup = messagesTo(worker, user).at(-1)?.reply_markup as InlineKeyboardMarkup | undefined;

  return markup?.inline_keyboard.flat() ?? [];
}

async function tickAt(worker: Worker, moment: string) {
  worker.clock.set(moment);
  await worker.tick();
}

async function press(worker: Worker, user: TelegramUserFixture, label: string) {
  const button = buttonsOf(worker, user).find(({ text }) => text === label);
  const update: Update = {
    update_id: 1,
    callback_query: {
      id: "callback-1",
      from: { ...user, is_bot: false },
      chat_instance: "instance",
      data: button !== undefined && "callback_data" in button ? button.callback_data : "",
    },
  };

  return worker.webhook(update);
}

describe("a Task Reminder", () => {
  test("«at the moment» of a date-only Task comes at 09:00 on each Assignee's clock", async () => {
    const worker = await startWithFamily();

    await createTask(worker, {
      title: "Вынести мусор",
      when: { date: "2026-10-05", ...dateOnly },
      assigneeIds: [worker.denisId, worker.asyaId],
      reminderOffsets: ["at-start"],
    });
    await tickAt(worker, "2026-10-04T23:00:00Z");

    expect(textsTo(worker, asya)).toEqual(["📌 Вынести мусор · 5 октября"]);
    expect(textsTo(worker, denis)).toEqual([]);

    await tickAt(worker, "2026-10-05T06:00:00Z");

    expect(textsTo(worker, denis)).toEqual(["📌 Вынести мусор · 5 октября"]);
  });

  test("of a timed Task comes its offset before, the same moment for everyone", async () => {
    const worker = await startWithFamily();

    await createTask(worker, {
      title: "Стоматолог",
      when: { ...dateOnly, date: "2026-10-05", time: "15:00", timeZone: "Europe/Moscow" },
      reminderOffsets: ["1h"],
      recipients: "everyone",
    });
    await tickAt(worker, "2026-10-05T11:00:00Z");

    expect(textsTo(worker, denis)).toEqual(["📌 Стоматолог · 5 октября, 15:00"]);
    expect(textsTo(worker, asya)).toEqual(["📌 Стоматолог · 5 октября, 22:00"]);
  });

  test("reaches the author of a Task without Assignees, or the Members chosen", async () => {
    const worker = await startWithFamily();
    const when = { date: "2026-10-05", ...dateOnly };

    await createTask(worker, { title: "Выключить бойлер", when, reminderOffsets: ["at-start"] });
    await createTask(worker, {
      title: "Позвонить маме",
      when,
      reminderOffsets: ["at-start"],
      recipients: [worker.asyaId],
    });
    await tickAt(worker, "2026-10-04T23:00:00Z");
    await tickAt(worker, "2026-10-05T06:00:00Z");

    expect(textsTo(worker, denis)).toEqual(["📌 Выключить бойлер · 5 октября"]);
    expect(textsTo(worker, asya)).toEqual(["📌 Позвонить маме · 5 октября"]);
  });

  test("of a Pet-linked Task also offers to record it", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, {
      title: "Таблетка от глистов",
      when: { date: "2026-10-05", ...dateOnly },
      reminderOffsets: ["at-start"],
      petId: await addBuick(worker),
    });

    await tickAt(worker, "2026-10-05T06:00:00Z");

    expect(buttonsOf(worker, denis).map(({ text }) => text)).toEqual([
      "✅ Готово",
      "⏰ Отложить",
      "📝 Записать",
    ]);
    expect(buttonsOf(worker, denis).at(-1)).toMatchObject({
      url: expect.stringContaining(`startapp=rec_${task.id}_2026-10-05`),
    });
  });

  test("of an archived Pet's Task stays silent", async () => {
    const worker = await startWithFamily();
    const buickId = await addBuick(worker);

    await createTask(worker, {
      title: "Таблетка от глистов",
      when: { date: "2026-10-06", ...dateOnly },
      reminderOffsets: ["at-start"],
      petId: buickId,
    });
    await request(worker, denis, { method: "POST", path: `/api/pets/${buickId}/archive` });
    await tickAt(worker, "2026-10-06T06:00:00Z");

    expect(textsTo(worker, denis)).toEqual([]);
  });
});

describe("«Готово»", () => {
  test("completes the Occurrence for everyone and rewrites every Recipient's message", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, {
      title: "Таблетка Бьюику",
      when: { date: "2026-10-05", ...dateOnly },
      recurrence: { frequency: "weekly", until: null },
      assigneeIds: [worker.denisId, worker.asyaId],
      reminderOffsets: ["at-start"],
    });

    await tickAt(worker, "2026-10-05T06:00:00Z");
    await press(worker, asya, "✅ Готово");

    const tasks = await bodyOf<TaskList>(request(worker, denis, { path: "/api/tasks" }));

    expect(tasks.find(({ id }) => id === task.id)?.completions).toMatchObject([
      { occurrence: "2026-10-05", by: "Ася" },
    ]);
    expect(worker.bot.editedMessages().map(({ text }) => text)).toEqual([
      "✅ Сделал(а) Ася: Таблетка Бьюику · 5 октября",
      "✅ Сделал(а) Ася: Таблетка Бьюику · 5 октября",
    ]);

    await tickAt(worker, "2026-10-12T06:00:00Z");

    expect(textsTo(worker, denis).at(-1)).toBe("📌 Таблетка Бьюику · 12 октября");
  });

  test.each([
    ["the Task is deleted", "DELETE"],
    ["the presser has left the Family", "LEAVE"],
  ])("completes nothing once %s", async (_case, change) => {
    const worker = await startWithFamily();
    const task = await createTask(worker, {
      title: "Полить цветы",
      when: { date: "2026-10-05", ...dateOnly },
      recipients: [worker.asyaId],
      reminderOffsets: ["at-start"],
    });

    await tickAt(worker, "2026-10-04T23:00:00Z");
    await (change === "DELETE"
      ? request(worker, denis, { method: "DELETE", path: `/api/tasks/${task.id}` })
      : request(worker, asya, { method: "POST", path: "/api/family/leave" }));
    await press(worker, asya, "✅ Готово");

    const tasks = await bodyOf<TaskList>(request(worker, denis, { path: "/api/tasks" }));

    expect(tasks.flatMap(({ completions }) => completions)).toEqual([]);
    expect(worker.bot.editedMessages()).toEqual([]);
  });
});

describe("«Отложить»", () => {
  test("brings a timed Task back in an hour", async () => {
    const worker = await startWithFamily();

    await createTask(worker, {
      title: "Стоматолог",
      when: { ...dateOnly, date: "2026-10-05", time: "15:00", timeZone: "Europe/Moscow" },
      reminderOffsets: ["1h"],
    });
    await tickAt(worker, "2026-10-05T11:00:00Z");
    await press(worker, denis, "⏰ Отложить");
    await tickAt(worker, "2026-10-05T11:59:00Z");

    expect(textsTo(worker, denis)).toHaveLength(1);

    await tickAt(worker, "2026-10-05T12:00:00Z");

    expect(textsTo(worker, denis)).toHaveLength(2);
  });

  test("brings a date-only Task back in a day", async () => {
    const worker = await startWithFamily();

    await createTask(worker, {
      title: "Купить корм",
      when: { date: "2026-10-06", ...dateOnly },
      reminderOffsets: ["at-start"],
    });
    await tickAt(worker, "2026-10-06T06:00:00Z");
    await press(worker, denis, "⏰ Отложить");
    await tickAt(worker, "2026-10-07T05:59:00Z");

    expect(textsTo(worker, denis)).toHaveLength(1);

    await tickAt(worker, "2026-10-07T06:00:00Z");

    expect(textsTo(worker, denis)).toHaveLength(2);
  });

  test("leaves an Occurrence already done alone and keeps the next one", async () => {
    const worker = await startWithFamily();

    await createTask(worker, {
      title: "Таблетка Бьюику",
      when: { date: "2026-10-05", ...dateOnly },
      recurrence: { frequency: "weekly", until: null },
      reminderOffsets: ["at-start"],
    });
    await tickAt(worker, "2026-10-05T06:00:00Z");
    await press(worker, denis, "✅ Готово");
    await press(worker, denis, "⏰ Отложить");
    await tickAt(worker, "2026-10-06T06:00:00Z");
    await tickAt(worker, "2026-10-12T06:00:00Z");

    expect(textsTo(worker, denis)).toEqual([
      "📌 Таблетка Бьюику · 5 октября",
      "📌 Таблетка Бьюику · 12 октября",
    ]);
    expect(worker.bot.answeredCallbacks().at(-1)).toMatchObject({ text: "Уже сделано" });
  });
});
