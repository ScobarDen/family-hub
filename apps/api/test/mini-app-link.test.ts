import { describe, expect, test } from "vite-plus/test";

import type { Pet } from "@family-hub/contract";

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

async function startWithBuick() {
  const worker = startWorker({ now: "2026-10-01T09:00:00Z" });
  const { familyId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

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
  const buick = await response.json<Pet>();

  return Object.assign(worker, { buickId: buick.id });
}

type Worker = Awaited<ReturnType<typeof startWithBuick>>;

async function vaccinate(
  worker: Worker,
  { vaccine, dueDate }: { vaccine: string; dueDate: string },
) {
  await request(worker, asya, {
    method: "POST",
    path: `/api/pets/${worker.buickId}/care-entries`,
    body: {
      occurredAt: worker.clock.now(),
      note: null,
      details: { kind: "vaccination", vaccine, cost: null, dueDate },
    },
  });
}

async function getMeCallsDuring(worker: Worker, act: () => Promise<unknown>) {
  const before = worker.bot.countCalls("getMe");

  await act();

  return worker.bot.countCalls("getMe") - before;
}

describe("the bot's name for Mini App links", () => {
  test("is asked once while a Care Entry is written beside several Due Dates", async () => {
    const worker = await startWithBuick();

    await vaccinate(worker, { vaccine: "Нобивак", dueDate: "2026-10-15" });
    await vaccinate(worker, { vaccine: "Бешенство", dueDate: "2026-10-15" });

    const calls = await getMeCallsDuring(worker, async () =>
      vaccinate(worker, { vaccine: "Лептоспироз", dueDate: "2026-10-15" }),
    );

    expect(calls).toBe(1);
  });

  test("is asked once in a cron tick that sends several Reminders", async () => {
    const worker = await startWithBuick();

    await vaccinate(worker, { vaccine: "Нобивак", dueDate: "2026-10-15" });
    await vaccinate(worker, { vaccine: "Бешенство", dueDate: "2026-10-15" });
    worker.clock.set("2026-10-15T09:00:00Z");

    const sentBefore = worker.bot.sentMessages().length;
    const calls = await getMeCallsDuring(worker, async () => worker.tick());

    expect(worker.bot.sentMessages().length - sentBefore).toBe(4);
    expect(calls).toBe(1);
  });
});
