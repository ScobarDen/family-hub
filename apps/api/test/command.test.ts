import type { InlineKeyboardMarkup, Update } from "@grammyjs/types";
import { describe, expect, test } from "vite-plus/test";

import type { Reminder } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { startWorker } from "./worker-harness.ts";

const denis = { id: 111, first_name: "Денис" };
const asya = { id: 222, first_name: "Ася" };
const stranger = { id: 999, first_name: "Незнакомец" };

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
  const worker = startWorker({ now: "2026-10-13T09:00:00Z" });
  const { familyId, ownerId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  worker.clock.set("2026-10-13T09:00:01Z");

  const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  await request(worker, denis, {
    method: "PUT",
    path: "/api/me/time-zone",
    body: { timeZone: "Europe/Moscow", isAuto: true },
  });

  return Object.assign(worker, { familyId, denisId: ownerId, asyaId });
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

let updateId = 0;

async function say(worker: Worker, user: TelegramUserFixture, text: string) {
  updateId += 1;

  const update: Update = {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: user.id, type: "private", first_name: user.first_name },
      from: { ...user, is_bot: false },
      text,
    },
  };

  return worker.webhook(update);
}

async function speak(worker: Worker, user: TelegramUserFixture, { duration = 4 } = {}) {
  updateId += 1;

  return worker.webhook({
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: user.id, type: "private", first_name: user.first_name },
      from: { ...user, is_bot: false },
      voice: {
        file_id: `voice-${updateId}`,
        file_unique_id: `unique-${updateId}`,
        duration,
        mime_type: "audio/ogg",
      },
    },
  });
}

function lastTo(worker: Worker, user: TelegramUserFixture) {
  return worker.bot.sentMessages().findLast(({ chat_id: chatId }) => chatId === user.id);
}

function buttonsOf(message: ReturnType<typeof lastTo>) {
  const markup = message?.reply_markup as InlineKeyboardMarkup | undefined;

  return markup?.inline_keyboard.flat() ?? [];
}

async function press(worker: Worker, user: TelegramUserFixture, data: string) {
  updateId += 1;

  await worker.webhook({
    update_id: updateId,
    callback_query: {
      id: `callback-${updateId}`,
      from: { ...user, is_bot: false },
      chat_instance: "instance",
      data,
    },
  });
}

function dataOf(message: ReturnType<typeof lastTo>, text: string): string {
  const button = buttonsOf(message).find((each) => each.text === text);

  return button !== undefined && "callback_data" in button ? (button.callback_data ?? "") : "";
}

const internet = {
  outcome: "reminder",
  text: "Оплатить интернет",
  date: "2026-10-16",
  time: "19:00",
  recurrence: { frequency: "monthly", until: null },
  visibility: "shared",
  recipientIds: null,
  missing: [],
  ambiguities: [],
};

async function reminders(worker: Worker, user: TelegramUserFixture) {
  const response = await request(worker, user, { path: "/api/reminders" });

  return response.json<Reminder[]>();
}

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
    expect(buttonsOf(preview).map(({ text }) => text)).toEqual(["Создать", "×"]);
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

    expect(buttonsOf(preview).map(({ text }) => text)).toEqual(["Ася", "Ася", "×"]);

    await press(worker, denis, dataOf(preview, "Ася"));

    const edited = worker.bot.editedMessages().at(-1);

    expect(edited?.text).toContain("Не хватает: время");
    expect(edited?.reply_markup?.inline_keyboard.flat().map(({ text }) => text)).toEqual(["×"]);
  });

  test("says when it did not understand and what it will not do", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: "{ broken" }, { response: { outcome: "unsupported" } });
    await say(worker, denis, "абракадабра");

    expect(lastTo(worker, denis)?.text).toMatch(/^Не понял/u);

    await say(worker, denis, "удали все напоминания");

    expect(lastTo(worker, denis)?.text).toBe(
      "Такое голосом и текстом не умею — только создать напоминание.",
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
