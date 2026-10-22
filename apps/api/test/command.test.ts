import { describe, expect, test } from "vite-plus/test";

import {
  asya,
  buttonsOf,
  dataOf,
  denis,
  internet,
  lastTo,
  press,
  reminders,
  request,
  say,
  speak,
  startWithFamily,
  stranger,
} from "./command-fixtures.ts";

describe("a text command to the bot", () => {
  test("answers with a preview and creates the Reminder on «Создать»", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: internet });

    const response = await say(worker, denis, "напомни в пятницу в 19:00 оплатить интернет");
    const preview = lastTo(worker, denis);

    expect(response.status).toBe(200);
    expect(preview?.text).toBe(
      "⏰ Оплатить интернет · пт 16 окт, 19:00 · каждый месяц · Денис, Ася",
    );
    expect(buttonsOf(preview).map(({ text }) => text)).toEqual(["Создать", "Изменить", "×"]);
    expect(buttonsOf(preview)[1]).toMatchObject({
      url: expect.stringMatching(
        /^https:\/\/t\.me\/family_hub_test_bot\?startapp=cmd_[\da-f-]{36}$/u,
      ),
    });
    expect(worker.ai.calls[0]?.model).toBe("primary-model");

    await press(worker, denis, dataOf(preview, "Создать"));

    expect(await reminders(worker, asya)).toMatchObject([
      {
        text: "Оплатить интернет",
        start: { date: "2026-10-16", time: "19:00", timeZone: "Europe/Moscow" },
        recurrence: { frequency: "monthly", until: null },
        isForEveryone: true,
      },
    ]);
    expect(worker.bot.editedMessages().at(-1)?.text).toMatch(/^✅ Создано/u);

    worker.clock.set("2026-10-16T16:00:00Z");
    await worker.tick();

    expect(lastTo(worker, asya)?.text).toBe("🔔 Оплатить интернет");
  });

  test("creates nothing on a second «Создать» or after «×»", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: internet }, { response: internet });
    await say(worker, denis, "напомни");

    const first = lastTo(worker, denis);

    await press(worker, denis, dataOf(first, "Создать"));
    await press(worker, denis, dataOf(first, "Создать"));
    await say(worker, denis, "напомни ещё раз");

    const second = lastTo(worker, denis);

    await press(worker, denis, dataOf(second, "×"));
    await press(worker, denis, dataOf(second, "Создать"));

    expect(await reminders(worker, denis)).toHaveLength(1);
    expect(worker.bot.editedMessages().at(-1)?.text).toBe("Отменено");
    expect(worker.bot.answeredCallbacks().at(-1)?.text).toBe("Черновик устарел");
  });

  test("lets the author alone act on a draft", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: internet });
    await say(worker, denis, "напомни");
    await press(worker, asya, dataOf(lastTo(worker, denis), "Создать"));

    expect(worker.bot.answeredCallbacks().at(-1)?.text).toBe("Это не ваш черновик");
    expect(await reminders(worker, denis)).toEqual([]);
  });

  test("offers the matching Members as buttons and creates nothing without a time", async () => {
    const worker = await startWithFamily();
    const mother = await worker.addMember(worker.familyId, { telegramId: 333, name: "Ася" });

    worker.ai.answer({
      response: {
        ...internet,
        time: null,
        ambiguities: [
          { field: "recipients", mention: "Ася", candidateIds: [worker.asyaId, mother] },
        ],
      },
    });
    await say(worker, denis, "напомни Асе в пятницу оплатить интернет");

    const preview = lastTo(worker, denis);

    expect(buttonsOf(preview).map(({ text }) => text)).toEqual(["Ася", "Ася", "Изменить", "×"]);

    await press(worker, denis, dataOf(preview, "Ася"));

    const edited = worker.bot.editedMessages().at(-1);

    expect(edited?.text).toContain("Не хватает: время");
    expect(edited?.reply_markup?.inline_keyboard.flat().map(({ text }) => text)).toEqual([
      "Изменить",
      "×",
    ]);
  });

  test("says when it did not understand and what it will not do", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: "{ broken" }, { response: { outcome: "unsupported" } });
    await say(worker, denis, "абракадабра");

    expect(lastTo(worker, denis)?.text).toMatch(/^Не понял/u);

    await say(worker, denis, "удали все напоминания");

    expect(lastTo(worker, denis)?.text).toBe(
      "Такое голосом и текстом не умею — только создать напоминание, событие или запись питомца.",
    );
  });

  test("stops at the Family's daily limit without asking the model, and when Neurons run out", async () => {
    const worker = await startWithFamily();

    worker.ai.runOutOfNeurons();
    await say(worker, denis, "напомни");

    expect(lastTo(worker, denis)?.text).toMatch(/^На сегодня команды кончились/u);

    worker.ai.answer({ response: internet }, { response: internet });
    await say(worker, denis, "напомни");
    await say(worker, asya, "напомни");
    await say(worker, denis, "напомни");

    expect(worker.ai.calls).toHaveLength(3);
    expect(lastTo(worker, denis)?.text).toMatch(/^На сегодня команды кончились/u);
  });

  test("tells a stranger the bot works by invitation", async () => {
    const worker = await startWithFamily();

    await say(worker, stranger, "напомни");

    expect(lastTo(worker, stranger)?.text).toMatch(/работает по приглашениям/u);
    expect(worker.ai.calls).toEqual([]);
  });

  test("forgets a draft after a day", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: internet });
    await say(worker, denis, "напомни");
    worker.clock.set("2026-10-14T09:00:01Z");
    await press(worker, denis, dataOf(lastTo(worker, denis), "Создать"));

    expect(worker.bot.answeredCallbacks().at(-1)?.text).toBe("Черновик устарел");
    expect(await reminders(worker, denis)).toEqual([]);
  });

  test("keeps the phrase's day and zone when «Создать» comes the next day in another zone", async () => {
    const worker = await startWithFamily();

    worker.clock.set("2026-10-13T20:00:00Z");
    worker.ai.answer({ response: { ...internet, date: "2026-10-14", time: "09:00" } });
    await say(worker, denis, "напомни завтра в 9 оплатить интернет");
    worker.clock.set("2026-10-14T06:00:00Z");
    await request(worker, denis, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Asia/Vladivostok", isAuto: true },
    });
    await press(worker, denis, dataOf(lastTo(worker, denis), "Создать"));

    expect(worker.ai.calls[0]?.input).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({ content: expect.stringContaining("Сегодня 2026-10-13") }),
      ]),
    });
    expect(await reminders(worker, denis)).toMatchObject([
      { start: { date: "2026-10-14", time: "09:00", timeZone: "Europe/Moscow" } },
    ]);
  });

  test("says a Recipient has left the Family and keeps the draft to change", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: { ...internet, recipientIds: [worker.asyaId] } });
    await say(worker, denis, "напомни Асе в пятницу в 19:00 оплатить интернет");
    await request(worker, denis, {
      method: "DELETE",
      path: `/api/family/members/${worker.asyaId}`,
    });
    await press(worker, denis, dataOf(lastTo(worker, denis), "Создать"));

    expect(worker.bot.editedMessages().at(-1)?.text).toMatch(
      /\n\nНе получилось создать: кого-то из получателей уже нет в семье\. Выберите получателей в «Изменить»\.$/u,
    );
    expect(await reminders(worker, denis)).toEqual([]);
  });
});

const grooming = {
  outcome: "event",
  title: "Груминг Бьюика",
  note: null,
  date: "2026-10-17",
  time: "12:00",
  endDate: null,
  endTime: null,
  recurrence: null,
  visibility: "shared",
  reminderOffsets: ["1d"],
  missing: [],
  ambiguities: [],
};

describe("an Event command to the bot", () => {
  test("previews the Event and creates it with its Reminder on «Создать»", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: grooming });
    await say(worker, denis, "в субботу в 12 груминг Бьюика, напомни за день");

    const preview = lastTo(worker, denis);

    expect(preview?.text).toBe("📅 Груминг Бьюика · сб 17 окт, 12:00 · напомнить за день");

    await press(worker, denis, dataOf(preview, "Создать"));

    const events = await request(worker, asya, { path: "/api/events" });

    expect(await events.json()).toMatchObject([
      {
        title: "Груминг Бьюика",
        start: { date: "2026-10-17", time: "12:00", timeZone: "Europe/Moscow" },
        reminderOffsets: ["1d"],
      },
    ]);

    worker.clock.set("2026-10-16T09:00:00Z");
    await worker.tick();

    expect(lastTo(worker, asya)?.text).toMatch(/Груминг Бьюика/u);
  });

  test("shows an all-day Event without a time", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({
      response: {
        ...grooming,
        title: "День рождения мамы",
        date: "2027-03-03",
        time: null,
        recurrence: { frequency: "yearly", until: null },
        reminderOffsets: [],
      },
    });
    await say(worker, denis, "каждый год 3 марта день рождения мамы");

    expect(lastTo(worker, denis)?.text).toBe(
      "📅 День рождения мамы · ср 3 мар, весь день · каждый год",
    );
  });

  test("keeps the zone the phrase was said in when the Member changes zone before «Создать»", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: grooming });
    await say(worker, denis, "в субботу в 12 груминг Бьюика");
    worker.clock.set("2026-10-13T19:00:01Z");
    await request(worker, denis, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Asia/Vladivostok", isAuto: true },
    });
    await press(worker, denis, dataOf(lastTo(worker, denis), "Создать"));

    const events = await request(worker, denis, { path: "/api/events" });

    expect(await events.json()).toMatchObject([
      { start: { date: "2026-10-17", time: "12:00", timeZone: "Europe/Moscow" } },
    ]);
  });

  test("says what does not add up in a draft the Event form would refuse", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: { ...grooming, endDate: "2026-10-16", endTime: "14:00" } });
    await say(worker, denis, "в субботу в 12 груминг Бьюика до пятницы");
    await press(worker, denis, dataOf(lastTo(worker, denis), "Создать"));

    expect(worker.bot.editedMessages().at(-1)?.text).toMatch(
      /\n\nНе получилось создать: в черновике не сходятся даты или поля\. Поправьте его в «Изменить»\.$/u,
    );
  });
});

describe("a voice command to the bot", () => {
  test("streams the voice into Whisper and previews the draft under the heard phrase", async () => {
    const worker = await startWithFamily();

    worker.ai.hear("напомни в пятницу в 19:00 оплатить интернет");
    worker.ai.answer({ response: internet });

    const response = await speak(worker, denis);
    const [speech, command] = worker.ai.calls;
    const audio = speech?.input.audio as { body: ReadableStream; contentType: string };
    const preview = lastTo(worker, denis);

    expect(response.status).toBe(200);
    expect(speech?.model).toBe("speech-model");
    expect(speech?.input.language).toBe("ru");
    expect(audio.contentType).toBe("audio/ogg");
    expect(await new Response(audio.body).text()).toMatch(/^ogg:voice\/voice-\d+\.oga$/u);
    expect(JSON.stringify(command?.input.messages)).toContain(
      "напомни в пятницу в 19:00 оплатить интернет",
    );
    expect(preview?.text).toBe(
      "🎙 «напомни в пятницу в 19:00 оплатить интернет»\n\n" +
        "⏰ Оплатить интернет · пт 16 окт, 19:00 · каждый месяц · Денис, Ася",
    );

    await press(worker, denis, dataOf(preview, "Создать"));

    expect(await reminders(worker, denis)).toMatchObject([{ text: "Оплатить интернет" }]);
  });

  test("turns down a voice longer than 30 seconds without downloading it or counting it", async () => {
    const worker = await startWithFamily();

    await speak(worker, denis, { duration: 31 });

    expect(lastTo(worker, denis)?.text).toBe("Слишком длинно — уложитесь в 30 секунд.");
    expect(worker.bot.downloadedFiles()).toEqual([]);
    expect(worker.ai.calls).toEqual([]);

    for (const phrase of ["раз", "два", "три"]) {
      worker.ai.hear(phrase);
      worker.ai.answer({ response: internet });
      await speak(worker, denis);
    }

    expect(lastTo(worker, denis)?.text).toMatch(/^🎙 «три»/u);
  });

  test("asks again on silence or a Whisper failure and counts both towards the limit", async () => {
    const worker = await startWithFamily();

    worker.ai.hear("  ");
    await speak(worker, denis);

    expect(lastTo(worker, denis)?.text).toBe("Не расслышал, попробуйте ещё раз.");

    worker.ai.answer(new Error("3010: invalid audio"));
    await speak(worker, denis);

    expect(lastTo(worker, denis)?.text).toBe("Не расслышал, попробуйте ещё раз.");

    worker.ai.hear("напомни");
    worker.ai.answer({ response: internet });
    await speak(worker, denis);
    await speak(worker, denis);

    expect(lastTo(worker, denis)?.text).toMatch(/^На сегодня команды кончились/u);
    expect(worker.bot.downloadedFiles()).toHaveLength(3);
  });

  test("says commands are over when Whisper runs out of Neurons", async () => {
    const worker = await startWithFamily();

    worker.ai.runOutOfNeurons();
    await speak(worker, denis);

    expect(lastTo(worker, denis)?.text).toMatch(/^На сегодня команды кончились/u);
  });

  test("tells a stranger the bot works by invitation without listening", async () => {
    const worker = await startWithFamily();

    await speak(worker, stranger);

    expect(lastTo(worker, stranger)?.text).toMatch(/работает по приглашениям/u);
    expect(worker.bot.downloadedFiles()).toEqual([]);
  });
});
