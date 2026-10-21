import type { InlineKeyboardMarkup, Update } from "@grammyjs/types";
import { describe, expect, test } from "vite-plus/test";

import type { CalendarEvent, Pet } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const denis = { id: 111, first_name: "Денис" };
const asya = { id: 222, first_name: "Ася" };

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
  const worker = startWorker({ now: "2026-10-01T09:00:00Z" });
  const { familyId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  for (const user of [denis, asya]) {
    await request(worker, user, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Europe/Moscow", isAuto: true },
    });
  }

  return worker;
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

function textsTo(worker: Worker, user: TelegramUserFixture) {
  return worker.bot
    .sentMessages()
    .filter(({ chat_id: chatId }) => chatId === user.id)
    .map(({ text }) => text);
}

async function tickAt(worker: Worker, moment: string) {
  worker.clock.set(moment);
  await worker.tick();
}

async function addBuick(worker: Worker, birthDate: string | null = "2022-10-20") {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/pets",
    body: {
      name: "Бьюик",
      species: "dog",
      breed: null,
      sex: null,
      birthDate,
      chipNumber: null,
      notes: null,
    },
  });

  return response.json<Pet>();
}

async function vaccinate(
  worker: Worker,
  petId: string,
  { vaccine, dueDate }: { vaccine: string; dueDate: string | null },
) {
  return request(worker, asya, {
    method: "POST",
    path: `/api/pets/${petId}/care-entries`,
    body: {
      occurredAt: worker.clock.now(),
      note: null,
      details: { kind: "vaccination", vaccine, cost: null, dueDate },
    },
  });
}

function buttonsOfLast(worker: Worker, user: TelegramUserFixture) {
  const markup = worker.bot.sentMessages().findLast(({ chat_id: chatId }) => chatId === user.id)
    ?.reply_markup as InlineKeyboardMarkup | undefined;

  return markup?.inline_keyboard.flat() ?? [];
}

describe("an Event's Reminders", () => {
  test("come at each chosen offset before a timed start, each closed on its own", async () => {
    const worker = await startWithFamily();
    const response = await request(worker, denis, {
      method: "POST",
      path: "/api/events",
      body: {
        title: "Созвон",
        note: null,
        start: { date: "2026-10-01", time: "19:00", timeZone: "Europe/Moscow" },
        end: null,
        recurrence: null,
        visibility: "shared",
        reminderOffsets: ["1h", "at-start"],
      },
    });
    const event = await response.json<CalendarEvent>();

    await tickAt(worker, "2026-10-01T15:00:00Z");

    expect(event.reminderOffsets).toEqual(["1h", "at-start"]);
    expect(textsTo(worker, asya)).toEqual(["📅 Созвон · 1 октября, 19:00"]);

    const done = buttonsOfLast(worker, asya).find(({ text }) => text === "✅ Готово");
    const update: Update = {
      update_id: 1,
      callback_query: {
        id: "callback-1",
        from: { ...asya, is_bot: false },
        chat_instance: "instance",
        data: done !== undefined && "callback_data" in done ? done.callback_data : "",
      },
    };

    await worker.webhook(update);
    await tickAt(worker, "2026-10-01T16:00:00Z");

    expect(textsTo(worker, asya)).toHaveLength(2);
    expect(textsTo(worker, denis)).toHaveLength(2);
  });

  test("of an all-day Event come at 09:00 the day before on the Recipient's clock", async () => {
    const worker = await startWithFamily();

    await request(worker, asya, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Asia/Vladivostok", isAuto: false },
    });
    await request(worker, denis, {
      method: "POST",
      path: "/api/events",
      body: {
        title: "Отпуск",
        note: null,
        start: { date: "2026-10-10", time: null, timeZone: null },
        end: null,
        recurrence: null,
        visibility: "shared",
        reminderOffsets: ["1d"],
      },
    });

    await tickAt(worker, "2026-10-08T23:00:00Z");

    expect(textsTo(worker, asya)).toEqual(["📅 Отпуск · 10 октября"]);
    expect(textsTo(worker, denis)).toEqual([]);

    await tickAt(worker, "2026-10-09T06:00:00Z");

    expect(textsTo(worker, denis)).toEqual(["📅 Отпуск · 10 октября"]);
  });
});

describe("a Pet's birthday", () => {
  test("is congratulated at 09:00 on the day, for everyone", async () => {
    const worker = await startWithFamily();

    await addBuick(worker);
    await tickAt(worker, "2026-10-20T05:59:00Z");

    expect(worker.bot.sentMessages()).toEqual([]);

    await tickAt(worker, "2026-10-20T06:00:00Z");

    expect(textsTo(worker, denis)).toEqual(["🎂 Сегодня день рождения у Бьюик!"]);
    expect(textsTo(worker, asya)).toHaveLength(1);
  });

  test("follows the Member to a new zone", async () => {
    const worker = await startWithFamily();

    await addBuick(worker);
    await request(worker, denis, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Asia/Vladivostok", isAuto: false },
    });
    await tickAt(worker, "2026-10-19T23:00:00Z");

    expect(textsTo(worker, denis)).toHaveLength(1);
    expect(textsTo(worker, asya)).toEqual([]);
  });

  test("stops for an archived Pet", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker);

    await request(worker, asya, { method: "POST", path: `/api/pets/${buick.id}/archive` });
    await tickAt(worker, "2026-10-20T06:00:00Z");

    expect(worker.bot.sentMessages()).toEqual([]);
  });

  test("comes back once the Pet is unarchived", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker);

    await request(worker, asya, { method: "POST", path: `/api/pets/${buick.id}/archive` });
    worker.clock.set("2026-10-10T09:00:00Z");
    await request(worker, asya, { method: "POST", path: `/api/pets/${buick.id}/unarchive` });
    await tickAt(worker, "2026-10-20T06:00:00Z");

    expect(textsTo(worker, denis)).toHaveLength(1);
  });
});

describe("a Due Date", () => {
  test("nudges a week ahead and on the day, with «📝 Записать» and «⏰ Отложить на день»", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker, null);

    await vaccinate(worker, buick.id, { vaccine: "Бешенство", dueDate: "2026-10-20" });
    await tickAt(worker, "2026-10-13T06:00:00Z");

    expect(textsTo(worker, denis)).toEqual(["💉 Прививка: Бешенство — Бьюик: срок 20 октября"]);
    expect(buttonsOfLast(worker, denis).map(({ text }) => text)).toEqual([
      "📝 Записать",
      "⏰ Отложить на день",
    ]);

    await tickAt(worker, "2026-10-20T06:00:00Z");

    expect(textsTo(worker, denis)).toHaveLength(2);
  });

  test("keeps nudging weekly while overdue, even when the bot was down for a day", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker, null);

    await vaccinate(worker, buick.id, { vaccine: "Бешенство", dueDate: "2026-10-05" });
    await tickAt(worker, "2026-10-05T06:00:00Z");
    await tickAt(worker, "2026-10-13T06:00:00Z");

    expect(textsTo(worker, asya)).toEqual([
      "💉 Прививка: Бешенство — Бьюик: срок 5 октября",
      "💉 Прививка: Бешенство — Бьюик: просрочено с 5 октября",
    ]);
  });

  test("is closed by a new vaccination of the same vaccine", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker, null);

    await vaccinate(worker, buick.id, { vaccine: "Бешенство", dueDate: "2026-10-20" });
    await vaccinate(worker, buick.id, { vaccine: "бешенство", dueDate: null });
    await tickAt(worker, "2026-10-13T06:00:00Z");
    await tickAt(worker, "2026-10-20T06:00:00Z");

    expect(worker.bot.sentMessages()).toEqual([]);
  });

  test("stops for an archived Pet", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker, null);

    await vaccinate(worker, buick.id, { vaccine: "Бешенство", dueDate: "2026-10-20" });
    await request(worker, asya, { method: "POST", path: `/api/pets/${buick.id}/archive` });
    await tickAt(worker, "2026-10-13T06:00:00Z");
    await tickAt(worker, "2026-10-20T06:00:00Z");

    expect(worker.bot.sentMessages()).toEqual([]);
  });
});
