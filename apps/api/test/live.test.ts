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

describe("live updates", () => {
  test("a write signals the Family's Object with the module it changed", async () => {
    const worker = await startWithFamily();

    await request(worker, asya, { method: "POST", path: "/api/tasks", body: ceiling });
    await request(worker, asya, {
      method: "POST",
      path: "/api/goals",
      body: { title: "" },
    });

    expect(worker.live.signals).toEqual([{ familyId: worker.familyId, modules: ["tasks", "pet"] }]);
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
      { familyId: worker.familyId, modules: ["tasks", "pet"], writer },
      { familyId: worker.familyId, modules: ["tasks", "pet"] },
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

  test("«Готово» pressed in the bot signals the presser's Family", async () => {
    const worker = await startWithFamily();

    await request(worker, asya, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Europe/Moscow", isAuto: true },
    });
    await request(worker, denis, { method: "POST", path: "/api/tasks", body: ceiling });
    worker.clock.set("2026-10-19T06:00:00Z");
    await worker.tick();

    const markup = worker.bot.sentMessages().findLast(({ chat_id: chatId }) => chatId === asya.id)
      ?.reply_markup as InlineKeyboardMarkup | undefined;
    const done = markup?.inline_keyboard.flat().find(({ text }) => text === "✅ Готово");

    worker.live.signals.length = 0;
    await worker.webhook({
      update_id: 1,
      callback_query: {
        id: "callback-1",
        from: { ...asya, is_bot: false },
        chat_instance: "instance",
        data: done !== undefined && "callback_data" in done ? done.callback_data : "",
      },
    });

    expect(worker.live.signals).toEqual([{ familyId: worker.familyId, modules: ["tasks", "pet"] }]);
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
