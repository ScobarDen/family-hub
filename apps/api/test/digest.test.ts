import type { InlineKeyboardMarkup } from "@grammyjs/types";
import { describe, expect, test } from "vite-plus/test";

import type { TaskChange } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker } from "./worker-harness.ts";

async function startWithFamily() {
  const worker = startWorker({ now: "2026-10-01T09:00:00Z" });
  const { familyId, ownerId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });
  const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

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

  return Object.assign(worker, { denisId: ownerId, asyaId });
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

async function addTask(worker: Worker, user: TelegramUserFixture, change: TaskChange) {
  await request(worker, user, { method: "POST", path: "/api/tasks", body: change });
}

function on(date: string, time: string | null = null): TaskChange["when"] {
  return {
    date,
    time,
    timeZone: time === null ? null : "Europe/Moscow",
    endDate: null,
    endTime: null,
  };
}

async function addOverdue(worker: Worker, title = "Отправить документы") {
  await addTask(worker, denis, {
    title,
    when: on("2026-09-28"),
    assigneeIds: [worker.denisId],
  });
}

describe("the morning digest", () => {
  test("comes at 09:00 on each Member's own clock with what is overdue and today", async () => {
    const worker = await startWithFamily();

    await addOverdue(worker);
    await addTask(worker, denis, { title: "ДР бабушки", when: on("2026-09-30") });
    await addTask(worker, denis, { title: "Созвон", when: on("2026-10-02", "19:00") });
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

    await addOverdue(worker);
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

  test("fits a long list into one message and says how much is left out", async () => {
    const worker = await startWithFamily();

    for (let index = 1; index <= 12; index += 1) {
      await addOverdue(worker, `${"Разобрать антресоль ".repeat(9)}${index}`);
    }

    await tickAt(worker, "2026-10-02T06:00:00Z");

    const [digest] = digestsTo(worker, denis);

    expect(digest?.text.split("\n").at(-1)).toBe("…и ещё 2");
  });

  test("says nothing on an empty day", async () => {
    const worker = await startWithFamily();

    await tickAt(worker, "2026-10-02T06:00:00Z");
    await tickAt(worker, "2026-10-03T06:00:00Z");

    expect(digestsTo(worker, denis)).toEqual([]);
  });

  test("shows a Private Task only to its owner", async () => {
    const worker = await startWithFamily();

    await addTask(worker, asya, {
      title: "Подарок Денису",
      when: on("2026-10-02"),
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

    await addOverdue(worker);
    worker.bot.blockChat(denis.id);
    await tickAt(worker, "2026-10-02T06:00:00Z");
    worker.bot.unblockChat(denis.id);

    const me = await request(worker, denis, { path: "/api/me" });
    const { settings } = await me.json<{ settings: { canMessage: boolean } }>();

    expect(settings.canMessage).toBe(false);
    expect(digestsTo(worker, denis)).toEqual([]);
  });

  test("comes back to a Member who left and joined again by an Invite", async () => {
    const worker = await startWithFamily();

    await addOverdue(worker);
    await request(worker, asya, { method: "POST", path: "/api/family/leave" });

    const invite = await request(worker, denis, { method: "POST", path: "/api/invites" });
    const { link } = await invite.json<{ link: string }>();
    const token = new URL(link).searchParams.get("startapp")?.replace(/^inv_/u, "") ?? "";

    await worker.request(`/api/invites/${token}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        initData: signInitData({
          botToken: worker.env.BOT_TOKEN,
          user: asya,
          authDate: worker.clock.iso(),
        }),
      }),
    });
    await tickAt(worker, "2026-10-01T23:00:00Z");

    expect(digestsTo(worker, asya)).toHaveLength(1);
  });
});
