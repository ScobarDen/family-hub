import type { InlineKeyboardMarkup } from "@grammyjs/types";
import { describe, expect, test } from "vite-plus/test";

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

  for (const [user, timeZone] of [
    [denis, "Europe/Moscow"],
    [asya, "Asia/Vladivostok"],
  ] as const) {
    await request(worker, user, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone, isAuto: true },
    });
  }

  return worker;
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

function digestsTo(worker: Worker, user: TelegramUserFixture) {
  return worker.bot
    .sentMessages()
    .filter(({ chat_id: chatId, text }) => chatId === user.id && text.startsWith("☀️"));
}

async function tickAt(worker: Worker, moment: string) {
  worker.clock.set(moment);
  await worker.tick();
}

async function addPlan(
  worker: Worker,
  user: TelegramUserFixture,
  {
    title,
    dueDate,
    visibility = "shared",
  }: { title: string; dueDate: string; visibility?: string },
) {
  await request(worker, user, {
    method: "POST",
    path: "/api/plans",
    body: {
      title,
      note: null,
      dueDate,
      reminder: null,
      assigneeId: null,
      visibility,
      petId: null,
      albumId: null,
    },
  });
}

describe("the morning digest", () => {
  test("comes at 09:00 on each Member's own clock with what is overdue and today", async () => {
    const worker = await startWithFamily();

    await addPlan(worker, denis, { title: "Отправить документы", dueDate: "2026-09-28" });
    await request(worker, denis, {
      method: "POST",
      path: "/api/events",
      body: {
        title: "Созвон",
        note: null,
        start: { date: "2026-10-02", time: "19:00", timeZone: "Europe/Moscow" },
        end: null,
        recurrence: null,
        visibility: "shared",
        reminderOffsets: [],
      },
    });
    await tickAt(worker, "2026-10-02T05:59:00Z");

    expect(digestsTo(worker, denis)).toEqual([]);

    await tickAt(worker, "2026-10-02T06:00:00Z");

    const [digest] = digestsTo(worker, denis);
    const button = (
      digest?.reply_markup as InlineKeyboardMarkup | undefined
    )?.inline_keyboard.flat()[0];

    expect(digest?.text).toBe(
      "☀️ Сводка на 2 октября\n\n⚠️ Просрочено\n• Отправить документы · 28 сентября\n\n📅 Сегодня\n• 19:00 Созвон",
    );
    expect(button).toMatchObject({
      text: "Открыть ленту",
      url: "https://t.me/family_hub_test_bot?startapp",
    });
    expect(digestsTo(worker, asya)).toHaveLength(1);
  });

  test("keeps to the Member's time and stops once turned off", async () => {
    const worker = await startWithFamily();

    await addPlan(worker, denis, { title: "Отправить документы", dueDate: "2026-09-28" });
    await request(worker, denis, {
      method: "PUT",
      path: "/api/me/digest",
      body: { isEnabled: true, time: "07:30" },
    });
    await request(worker, asya, {
      method: "PUT",
      path: "/api/me/digest",
      body: { isEnabled: false, time: "09:00" },
    });
    await tickAt(worker, "2026-10-02T04:30:00Z");

    expect(digestsTo(worker, denis)).toHaveLength(1);

    await tickAt(worker, "2026-10-03T00:00:00Z");

    expect(digestsTo(worker, asya)).toEqual([]);
  });

  test("says nothing on an empty day", async () => {
    const worker = await startWithFamily();

    await tickAt(worker, "2026-10-02T06:00:00Z");
    await tickAt(worker, "2026-10-03T06:00:00Z");

    expect(digestsTo(worker, denis)).toEqual([]);
  });

  test("shows a Private Plan only to its owner", async () => {
    const worker = await startWithFamily();

    await addPlan(worker, asya, {
      title: "Подарок Денису",
      dueDate: "2026-10-02",
      visibility: "private",
    });
    await tickAt(worker, "2026-10-02T06:00:00Z");

    expect(digestsTo(worker, denis)).toEqual([]);
    expect(digestsTo(worker, asya).map(({ text }) => text)).toEqual([
      "☀️ Сводка на 2 октября\n\n📅 Сегодня\n• Подарок Денису",
    ]);
  });

  test("marks a Member who blocked the bot as unreachable and moves on to the next day", async () => {
    const worker = await startWithFamily();

    await addPlan(worker, denis, { title: "Отправить документы", dueDate: "2026-09-28" });
    worker.bot.blockChat(denis.id);
    await tickAt(worker, "2026-10-02T06:00:00Z");
    worker.bot.unblockChat(denis.id);

    const me = await request(worker, denis, { path: "/api/me" });
    const { settings } = await me.json<{ settings: { canMessage: boolean } }>();

    expect(settings.canMessage).toBe(false);
    expect(digestsTo(worker, denis)).toEqual([]);
  });
});
