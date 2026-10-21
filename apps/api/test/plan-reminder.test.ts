import type { InlineKeyboardMarkup, Update } from "@grammyjs/types";
import { describe, expect, test } from "vite-plus/test";

import type { Plan, PlanChange } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const denis = { id: 111, first_name: "Денис" };
const asya = { id: 222, first_name: "Ася" };

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

async function request(
  worker: ReturnType<typeof startWorker>,
  user: TelegramUserFixture,
  { method, path, body }: { method: string; path: string; body?: unknown },
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

  test("is dropped once the Plan is completed in the app", async () => {
    const worker = await startWithFamily();
    const plan = await createPlan(worker, { assigneeId: worker.asyaId });

    await request(worker, asya, { method: "POST", path: `/api/plans/${plan.id}/complete` });
    await tickAt(worker, "2026-10-19T06:00:00Z");

    expect(textsTo(worker, asya)).toEqual([]);
  });
});
