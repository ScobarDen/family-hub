import { describe, expect, test } from "vite-plus/test";

import {
  buttonsOf,
  denis,
  internet,
  lastTo,
  request,
  say,
  speak,
  startWithFamily,
  stranger,
} from "./command-fixtures.ts";

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

describe("/remind", () => {
  test("answers with the Command Draft of the text after it", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: internet });
    await say(worker, denis, "/remind в пятницу в 19:00 оплатить интернет");

    const preview = lastTo(worker, denis);

    expect(preview?.text).toMatch(/^⏰ Оплатить интернет · пт 16 окт, 19:00/u);
    expect(buttonsOf(preview).map(({ text }) => text)).toEqual(["Создать", "Изменить", "×"]);
    expect(JSON.stringify(worker.ai.calls.at(-1)?.input)).not.toContain("/remind");
  });

  test("asks what to remind of without asking the model", async () => {
    const worker = await startWithFamily();

    await say(worker, denis, "/remind");

    expect(lastTo(worker, denis)?.text).toMatch(/^Напишите, что напомнить/u);
    expect(worker.ai.calls).toEqual([]);
  });

  test("tells a stranger the bot works by invitation", async () => {
    const worker = await startWithFamily();

    await say(worker, stranger, "/remind купить корм");

    expect(lastTo(worker, stranger)?.text).toMatch(/работает по приглашениям/u);
    expect(worker.ai.calls).toEqual([]);
  });
});

describe("a command being parsed", () => {
  test("shows «печатает…» for a text command", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: internet });
    await say(worker, denis, "напомни в пятницу оплатить интернет");

    expect(worker.bot.countCalls("sendChatAction")).toBe(1);
  });

  test("shows «печатает…» for a voice command", async () => {
    const worker = await startWithFamily();

    worker.ai.hear("напомни в пятницу оплатить интернет");
    worker.ai.answer({ response: internet });
    await speak(worker, denis);

    expect(worker.bot.countCalls("sendChatAction")).toBe(1);
  });
});
