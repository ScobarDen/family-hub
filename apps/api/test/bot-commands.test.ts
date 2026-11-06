import { describe, expect, test } from "vite-plus/test";

import {
  buttonsOf,
  denis,
  lastTo,
  request,
  say,
  speak,
  startWithFamily,
  stranger,
  type Worker,
} from "./bot-fixtures.ts";

describe("/today", () => {
  test("sends what the morning digest shows", async () => {
    const worker = await startWithFamily();

    await request(worker, denis, {
      method: "POST",
      path: "/api/tasks",
      body: {
        title: "Отправить документы",
        when: { date: "2026-10-10", time: null, timeZone: null, endDate: null, endTime: null },
        assigneeIds: [worker.denisId],
      },
    });
    await say(worker, denis, "/today");

    const digest = lastTo(worker, denis);

    expect(digest?.text).toBe(
      "☀️ Сводка на 13 октября\n\n⚠️ Просрочено\n• Отправить документы · 10 октября",
    );
    expect(buttonsOf(digest)[0]).toMatchObject({
      text: "Открыть ленту",
      url: "https://t.me/family_hub_test_bot?startapp",
    });
  });

  test("says so on a day with nothing to do", async () => {
    const worker = await startWithFamily();

    await say(worker, denis, "/today");

    expect(lastTo(worker, denis)?.text).toBe("☀️ Сводка на 13 октября\n\nНа сегодня ничего нет");
  });

  test("tells a stranger the bot works by invitation", async () => {
    const worker = await startWithFamily();

    await say(worker, stranger, "/today");

    expect(lastTo(worker, stranger)?.text).toMatch(/работает по приглашениям/u);
  });
});

describe("a message the bot does not read", () => {
  test.each([
    { what: "text", send: async (worker: Worker) => say(worker, denis, "купить корм Бьюику") },
    { what: "a voice message", send: async (worker: Worker) => speak(worker, denis) },
  ])("answers $what with a button into the app", async ({ send }) => {
    const worker = await startWithFamily();

    await send(worker);

    const answer = lastTo(worker, denis);

    expect(answer?.text).toBe(
      "Я больше не разбираю сообщения. Добавляйте дела и записи в приложении — там это быстрее.",
    );
    expect(buttonsOf(answer)).toEqual([
      { text: "Открыть", web_app: { url: "https://scobarden.github.io/family-hub/" } },
    ]);
  });

  test("leaves an unknown /command unanswered", async () => {
    const worker = await startWithFamily();

    await say(worker, denis, "/remind купить корм");

    expect(lastTo(worker, denis)).toBeUndefined();
  });
});
