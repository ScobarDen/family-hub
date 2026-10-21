import { describe, expect, test } from "vite-plus/test";

import type { Plan, PlanChange } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const now = "2026-10-04T09:00:00Z";
const denis = { id: 111, first_name: "Денис", allows_write_to_pm: true };
const asya = { id: 222, first_name: "Ася", allows_write_to_pm: true };

const ceiling: PlanChange = {
  title: "Покрасить потолок",
  note: null,
  dueDate: "2026-10-20",
  assigneeId: null,
  visibility: "shared",
};

async function call(
  worker: ReturnType<typeof startWorker>,
  user: TelegramUserFixture,
  { method, path, body }: { method: string; path: string; body: unknown },
) {
  const session = await worker.request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initData: signInitData({ botToken: worker.env.BOT_TOKEN, user, authDate: now }),
    }),
  });
  const { token = "" } = await session.json<{ token?: string }>();

  return worker.request(path, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function startWithFamily() {
  const worker = startWorker({ now });
  const { familyId, ownerId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });
  const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  return Object.assign(worker, { denisId: ownerId, asyaId });
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

async function createPlan(worker: Worker, user: TelegramUserFixture, change: Partial<PlanChange>) {
  const response = await call(worker, user, {
    method: "POST",
    path: "/api/plans",
    body: { ...ceiling, ...change },
  });

  return response.json<Plan>();
}

async function updatePlan(
  worker: Worker,
  user: TelegramUserFixture,
  { planId, ...change }: Partial<PlanChange> & { planId: string },
) {
  return call(worker, user, {
    method: "PUT",
    path: `/api/plans/${planId}`,
    body: { ...ceiling, ...change },
  });
}

function messagesTo(worker: Worker, user: TelegramUserFixture) {
  return worker.bot.sentMessages().filter(({ chat_id: chatId }) => chatId === user.id);
}

describe("making someone the Assignee", () => {
  test("sends them the Plan with a button that opens it", async () => {
    const worker = await startWithFamily();

    const plan = await createPlan(worker, asya, { assigneeId: worker.denisId });

    expect(messagesTo(worker, denis)).toEqual([
      {
        chat_id: denis.id,
        text: "🧑 Ася назначил(а) тебе: Покрасить потолок · до 20 октября",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Открыть",
                url: `https://t.me/family_hub_test_bot?startapp=plan_${plan.id}`,
              },
            ],
          ],
        },
      },
    ]);
  });

  test("tells the new Assignee of a Subplan, without a date when there is none", async () => {
    const worker = await startWithFamily();
    const plan = await createPlan(worker, asya, {});

    await call(worker, asya, {
      method: "POST",
      path: `/api/plans/${plan.id}/subplans`,
      body: { title: "Купить краску", dueDate: null, assigneeId: worker.denisId },
    });

    expect(messagesTo(worker, denis).map(({ text }) => text)).toEqual([
      "🧑 Ася назначил(а) тебе: Купить краску",
    ]);
  });

  test("tells whoever a Plan is handed over to, and only once", async () => {
    const worker = await startWithFamily();
    const plan = await createPlan(worker, denis, { assigneeId: worker.denisId });

    await updatePlan(worker, denis, { planId: plan.id, assigneeId: worker.asyaId });
    await updatePlan(worker, denis, { planId: plan.id, assigneeId: worker.asyaId, note: "Белой" });

    expect(messagesTo(worker, asya)).toHaveLength(1);
  });

  test("stays quiet when a Member takes the Plan themselves or clears the Assignee", async () => {
    const worker = await startWithFamily();
    const plan = await createPlan(worker, asya, { assigneeId: worker.asyaId });

    await updatePlan(worker, asya, { planId: plan.id, assigneeId: null });

    expect(worker.bot.sentMessages()).toEqual([]);
  });

  test("stays quiet towards a Member the bot cannot write to", async () => {
    const worker = await startWithFamily();

    await worker.markUnreachable(worker.denisId);
    await createPlan(worker, asya, { assigneeId: worker.denisId });

    expect(messagesTo(worker, denis)).toEqual([]);
  });

  test("marks the Assignee unreachable when they blocked the bot, and still saves the Plan", async () => {
    const worker = await startWithFamily();

    worker.bot.blockChat(denis.id);
    const plan = await createPlan(worker, asya, { assigneeId: worker.denisId });
    const me = await call(
      worker,
      { ...denis, allows_write_to_pm: false },
      {
        method: "GET",
        path: "/api/me",
        body: undefined,
      },
    );

    expect(plan.assignee?.name).toBe("Денис");
    expect(await me.json()).toMatchObject({ settings: { canMessage: false } });
  });
});
