import type { InlineKeyboardMarkup } from "@grammyjs/types";
import { describe, expect, test } from "vite-plus/test";

import { liveClientHeader, liveProtocol, type TaskChange } from "@family-hub/contract";

import { asya, denis, request, startWorker, tokenOf } from "./worker-harness.ts";

const ceiling: TaskChange = {
  title: "Покрасить потолок",
  when: { date: "2026-10-20", time: null, timeZone: null, endDate: null, endTime: null },
  reminderOffsets: ["1d"],
  recipients: "everyone",
};

async function startWithFamily() {
  const worker = startWorker({ now: "2026-10-01T09:00:00Z" });
  const { familyId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  return Object.assign(worker, { familyId });
}

async function addBuick(worker: Awaited<ReturnType<typeof startWithFamily>>): Promise<string> {
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

// Asya gets the bot's Reminder of Denis's Task; what came before it is not looked at.
async function remindAsya() {
  const worker = await startWithFamily();

  await request(worker, asya, {
    method: "PUT",
    path: "/api/me/time-zone",
    body: { timeZone: "Europe/Moscow", isAuto: true },
  });
  await request(worker, denis, { method: "POST", path: "/api/tasks", body: ceiling });
  worker.clock.set("2026-10-19T06:00:00Z");
  await worker.tick();
  worker.live.signals.length = 0;

  return worker;
}

async function press(
  worker: Awaited<ReturnType<typeof startWithFamily>>,
  { presser, button }: { presser: typeof asya; button: "✅ Готово" | "⏰ Отложить" },
): Promise<void> {
  const markup = worker.bot.sentMessages().findLast(({ chat_id: chatId }) => chatId === asya.id)
    ?.reply_markup as InlineKeyboardMarkup | undefined;
  const pressed = markup?.inline_keyboard.flat().find(({ text }) => text === button);

  await worker.webhook({
    update_id: 1,
    callback_query: {
      id: "callback-1",
      from: { ...presser, is_bot: false },
      chat_instance: "instance",
      data: pressed !== undefined && "callback_data" in pressed ? pressed.callback_data : "",
    },
  });
}

async function pressDone(
  worker: Awaited<ReturnType<typeof startWithFamily>>,
  presser: typeof asya,
): Promise<void> {
  await press(worker, { presser, button: "✅ Готово" });
}

describe("live updates", () => {
  test("a write signals the Family's Object with the module it changed", async () => {
    const worker = await startWithFamily();

    await request(worker, asya, { method: "POST", path: "/api/tasks", body: ceiling });
    await request(worker, asya, {
      method: "POST",
      path: "/api/goals",
      body: { title: "" },
    });

    expect(worker.live.signals).toEqual([{ familyId: worker.familyId, modules: ["tasks"] }]);
  });

  test("a write names the open app that made it, so its own echo is told apart", async () => {
    const worker = await startWithFamily();
    const writer = "0f8f2a52-3c4e-4b8a-9d55-6a1f0e2b7c11";

    await request(worker, asya, {
      method: "POST",
      path: "/api/tasks",
      body: ceiling,
      headers: { [liveClientHeader]: writer },
    });
    await request(worker, asya, {
      method: "POST",
      path: "/api/tasks",
      body: ceiling,
      headers: { [liveClientHeader]: "<script>" },
    });

    expect(worker.live.signals).toEqual([
      { familyId: worker.familyId, modules: ["tasks"], writer },
      { familyId: worker.familyId, modules: ["tasks"] },
    ]);
  });

  test("a read and a Member's own settings signal nothing", async () => {
    const worker = await startWithFamily();

    await request(worker, asya, { path: "/api/tasks" });
    await request(worker, asya, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Europe/Moscow", isAuto: true },
    });

    expect(worker.live.signals).toEqual([]);
  });

  test("a Task linked to a Pet tells the Pet's card too", async () => {
    const worker = await startWithFamily();
    const petId = await addBuick(worker);

    worker.live.signals.length = 0;
    await request(worker, asya, {
      method: "POST",
      path: "/api/tasks",
      body: { ...ceiling, petId },
    });

    expect(worker.live.signals).toEqual([{ familyId: worker.familyId, modules: ["tasks", "pet"] }]);
  });

  test("a new Pet tells the Pet screens and the Tasks that show it", async () => {
    const worker = await startWithFamily();

    await addBuick(worker);

    expect(worker.live.signals).toEqual([{ familyId: worker.familyId, modules: ["pet", "tasks"] }]);
  });

  test("a Care Entry tells the Pet's card", async () => {
    const worker = await startWithFamily();
    const petId = await addBuick(worker);

    worker.live.signals.length = 0;
    await request(worker, asya, {
      method: "POST",
      path: `/api/pets/${petId}/care-entries`,
      body: {
        occurredAt: Date.parse("2026-10-01T08:00:00Z"),
        note: "Бодрый",
        details: { kind: "note" },
      },
    });

    expect(worker.live.signals).toEqual([{ familyId: worker.familyId, modules: ["pet"] }]);
  });

  test("a Care Entry with «Повторить» tells the Tasks of its follow-up too", async () => {
    const worker = await startWithFamily();
    const petId = await addBuick(worker);

    worker.live.signals.length = 0;
    await request(worker, asya, {
      method: "POST",
      path: `/api/pets/${petId}/care-entries`,
      body: {
        occurredAt: Date.parse("2026-10-01T08:00:00Z"),
        note: null,
        repeatOn: "2027-10-01",
        details: { kind: "vaccination", vaccine: "Нобивак DHPPi", cost: null },
      },
    });

    expect(worker.live.signals).toEqual([{ familyId: worker.familyId, modules: ["tasks", "pet"] }]);
  });

  test("a Savings Goal tells the Savings Goals", async () => {
    const worker = await startWithFamily();

    await request(worker, asya, {
      method: "POST",
      path: "/api/goals",
      body: {
        title: "Отпуск в Турции",
        target: 100_000,
        deadline: null,
        icon: "palmtree",
        color: "teal",
        note: null,
        visibility: "shared",
      },
    });

    expect(worker.live.signals).toEqual([{ familyId: worker.familyId, modules: ["goals"] }]);
  });

  test("a Recipe tells the Recipes", async () => {
    const worker = await startWithFamily();

    await request(worker, asya, {
      method: "POST",
      path: "/api/recipes",
      body: { title: "Лазанья", ingredients: "", method: null },
    });

    expect(worker.live.signals).toEqual([{ familyId: worker.familyId, modules: ["recipes"] }]);
  });

  test("«Готово» pressed in the bot signals the presser's Family", async () => {
    const worker = await remindAsya();

    await pressDone(worker, asya);

    expect(worker.live.signals).toEqual([{ familyId: worker.familyId, modules: ["tasks"] }]);
  });

  test("«Готово» pressed again in the bot signals nothing", async () => {
    const worker = await remindAsya();

    await pressDone(worker, asya);
    worker.live.signals.length = 0;
    await pressDone(worker, asya);

    expect(worker.live.signals).toEqual([]);
  });

  test("«Отложить» in the bot signals nothing", async () => {
    const worker = await remindAsya();

    await press(worker, { presser: asya, button: "⏰ Отложить" });

    expect(worker.live.signals).toEqual([]);
  });

  test("a Task unlinked from its Pet still tells the Pet's card", async () => {
    const worker = await startWithFamily();
    const petId = await addBuick(worker);
    const created = await request(worker, asya, {
      method: "POST",
      path: "/api/tasks",
      body: { ...ceiling, petId },
    });
    const { id } = await created.json<{ id: string }>();

    worker.live.signals.length = 0;
    await request(worker, asya, { method: "PUT", path: `/api/tasks/${id}`, body: ceiling });

    expect(worker.live.signals).toEqual([{ familyId: worker.familyId, modules: ["tasks", "pet"] }]);
  });

  test("a Pet Memo tells only the Pet's card", async () => {
    const worker = await startWithFamily();
    const petId = await addBuick(worker);

    worker.live.signals.length = 0;
    await request(worker, asya, {
      method: "PUT",
      path: `/api/pets/${petId}/memo`,
      body: { food: "Acana, 2 раза в день", clinic: null, important: null },
    });

    expect(worker.live.signals).toEqual([{ familyId: worker.familyId, modules: ["pet"] }]);
  });

  test("«Готово» on another Member's Reminder signals nothing", async () => {
    const worker = await remindAsya();

    await pressDone(worker, denis);

    expect(worker.live.signals).toEqual([]);
  });

  test("the socket opens on the Family's Object for a valid session token", async () => {
    const worker = await startWithFamily();

    const response = await worker.request("/api/live", {
      headers: {
        upgrade: "websocket",
        "sec-websocket-protocol": `${liveProtocol}, ${await tokenOf(worker, asya)}`,
      },
    });

    expect(response.headers.get("sec-websocket-protocol")).toBe(liveProtocol);
    expect(worker.live.opened).toEqual([worker.familyId]);
  });

  test("the socket stays closed without a session token", async () => {
    const worker = await startWithFamily();

    const response = await worker.request("/api/live", {
      headers: { upgrade: "websocket", "sec-websocket-protocol": `${liveProtocol}, forged` },
    });

    expect(response.status).toBe(401);
    expect(worker.live.opened).toEqual([]);
  });
});
