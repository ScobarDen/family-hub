import type { InlineKeyboardMarkup, Update } from "@grammyjs/types";
import { describe, expect, test } from "vite-plus/test";

import type { Plan, PlanChange } from "@family-hub/contract";

import { type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker } from "./worker-harness.ts";

const ceiling: PlanChange = {
  title: "Покрасить потолок",
  note: null,
  dueDate: "2026-10-20",
  reminder: "1d",
  assigneeId: null,
  visibility: "shared",
  petId: null,
  albumId: null,
};

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
      body: { timeZone: "Europe/Moscow", isAuto: true },
    });
  }

  return Object.assign(worker, { denisId: ownerId, asyaId });
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

async function createPlan(worker: Worker, change: Partial<PlanChange>) {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/plans",
    body: { ...ceiling, ...change },
  });

  return response.json<Plan>();
}

function textsTo(worker: Worker, user: TelegramUserFixture) {
  return worker.bot
    .sentMessages()
    .filter(({ chat_id: chatId }) => chatId === user.id && chatId !== undefined)
    .map(({ text }) => text)
    .filter((text) => text.startsWith("📌"));
}

async function tickAt(worker: Worker, moment: string) {
  worker.clock.set(moment);
  await worker.tick();
}

function pressDone(worker: Worker, user: TelegramUserFixture) {
  const markup = worker.bot
    .sentMessages()
    .findLast(({ chat_id: chatId, text }) => chatId === user.id && text.startsWith("📌"))
    ?.reply_markup as InlineKeyboardMarkup | undefined;
  const done = markup?.inline_keyboard.flat().find(({ text }) => text === "✅ Выполнено");
  const update: Update = {
    update_id: 1,
    callback_query: {
      id: "callback-1",
      from: { ...user, is_bot: false },
      chat_instance: "instance",
      data: done !== undefined && "callback_data" in done ? done.callback_data : "",
    },
  };

  return worker.webhook(update);
}

describe("a Plan's deadline Reminder", () => {
  test("reaches the Assignee alone at 09:00 a day before", async () => {
    const worker = await startWithFamily();

    await createPlan(worker, { assigneeId: worker.asyaId });
    await tickAt(worker, "2026-10-19T05:59:00Z");

    expect(textsTo(worker, asya)).toEqual([]);

    await tickAt(worker, "2026-10-19T06:00:00Z");

    expect(textsTo(worker, asya)).toEqual(["📌 Покрасить потолок · до 20 октября"]);
    expect(textsTo(worker, denis)).toEqual([]);
  });

  test("reaches everyone when nobody is assigned, and a Private one only its owner", async () => {
    const worker = await startWithFamily();

    await createPlan(worker, { reminder: "on-day" });
    await createPlan(worker, { title: "Сюрприз", reminder: "on-day", visibility: "private" });
    await tickAt(worker, "2026-10-20T06:00:00Z");

    expect(textsTo(worker, asya)).toEqual(["📌 Покрасить потолок · до 20 октября"]);
    expect(textsTo(worker, denis)).toHaveLength(2);
  });

  test("of a Subplan names its Plan", async () => {
    const worker = await startWithFamily();
    const plan = await createPlan(worker, { reminder: null });

    await request(worker, denis, {
      method: "POST",
      path: `/api/plans/${plan.id}/subplans`,
      body: { title: "Купить краску", dueDate: "2026-10-10", assigneeId: null, reminder: "1w" },
    });
    await tickAt(worker, "2026-10-03T06:00:00Z");

    expect(textsTo(worker, asya)).toEqual(["📌 Покрасить потолок: Купить краску · до 10 октября"]);
  });

  test("completes the Plan from the bot with «✅ Выполнено»", async () => {
    const worker = await startWithFamily();
    const plan = await createPlan(worker, { assigneeId: worker.asyaId });

    await tickAt(worker, "2026-10-19T06:00:00Z");
    await pressDone(worker, asya);

    const plans = await request(worker, denis, { method: "GET", path: "/api/plans" });
    const [saved] = await plans.json<Plan[]>();

    expect(saved?.id).toBe(plan.id);
    expect(saved?.completed?.by).toBe("Ася");
  });

  test("marks the message with who completed the Plan", async () => {
    const worker = await startWithFamily();

    await createPlan(worker, { assigneeId: worker.asyaId });
    await tickAt(worker, "2026-10-19T06:00:00Z");
    await pressDone(worker, asya);

    expect(worker.bot.editedMessages().map(({ text }) => text)).toEqual([
      "✅ Сделал(а) Ася: Покрасить потолок · до 20 октября",
    ]);
  });

  test("is dropped once the Plan is completed in the app", async () => {
    const worker = await startWithFamily();
    const plan = await createPlan(worker, { assigneeId: worker.asyaId });

    await request(worker, asya, { method: "POST", path: `/api/plans/${plan.id}/complete` });
    await tickAt(worker, "2026-10-19T06:00:00Z");

    expect(textsTo(worker, asya)).toEqual([]);
  });
});

describe("another Family's Member", () => {
  const stranger = { id: 333, first_name: "Пётр" };

  async function startWithStranger() {
    const worker = await startWithFamily();

    await worker.addFamily({ name: "Соседи", owner: { telegramId: stranger.id, name: "Пётр" } });
    await request(worker, stranger, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Europe/Moscow", isAuto: true },
    });

    return worker;
  }

  test("cannot touch a Plan by its id, nor double its Reminder", async () => {
    const worker = await startWithStranger();
    const plan = await createPlan(worker, { assigneeId: worker.asyaId });
    const calls = [
      { method: "PUT", path: `/api/plans/${plan.id}`, body: ceiling },
      { method: "POST", path: `/api/plans/${plan.id}/complete` },
      { method: "DELETE", path: `/api/plans/${plan.id}` },
    ];
    const statuses: number[] = [];

    for (const call of calls) {
      const response = await request(worker, stranger, call);

      statuses.push(response.status);
    }

    await tickAt(worker, "2026-10-19T06:00:00Z");

    expect(statuses).toEqual([404, 404, 404]);
    expect(textsTo(worker, asya)).toEqual(["📌 Покрасить потолок · до 20 октября"]);
    expect(textsTo(worker, stranger)).toEqual([]);
  });

  test("never hears of the Family's deadlines", async () => {
    const worker = await startWithStranger();

    await createPlan(worker, { reminder: "on-day" });
    await tickAt(worker, "2026-10-20T06:00:00Z");

    expect(textsTo(worker, denis)).toHaveLength(1);
    expect(textsTo(worker, stranger)).toEqual([]);
  });
});
