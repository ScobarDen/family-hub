import { describe, expect, test } from "vite-plus/test";

import type { CommandOutcome, DraftCreated } from "@family-hub/contract";

import {
  asya,
  denis,
  internet,
  lastTo,
  buttonsOf,
  record,
  recorded,
  request,
  say,
  startWithFamily,
  tasks,
} from "./command-fixtures.ts";

const phrase = "напомни в пятницу в 19:00 оплатить интернет";

function draftIdOf(outcome: CommandOutcome): string {
  return outcome.status === "draft" ? outcome.draftId : "";
}

function draftIdInLink(url: string): string {
  return new URL(url).searchParams.get("startapp")?.replace(/^cmd_/u, "") ?? "";
}

describe("a recording from the Mini App microphone", () => {
  test("streams into Whisper and answers with the draft, which «Создать» turns into a Task", async () => {
    const worker = await startWithFamily();

    worker.ai.hear(phrase);
    worker.ai.answer({ response: internet });

    const response = await record(worker, denis);
    const outcome = await response.json<CommandOutcome>();
    const audio = worker.ai.calls[0]?.input.audio as { body: ReadableStream; contentType: string };

    expect(outcome).toMatchObject({
      status: "draft",
      heard: phrase,
      draft: { kind: "task", title: "Оплатить интернет", date: "2026-10-16", time: "19:00" },
      phrase: { saidAt: Date.parse("2026-10-13T09:00:01Z"), timeZone: "Europe/Moscow" },
    });
    expect(audio.contentType).toBe("audio/mp4");
    expect(await new Response(audio.body).text()).toBe("mp4:recording");

    const created = await request(worker, denis, {
      method: "POST",
      path: `/api/commands/${draftIdOf(outcome)}/create`,
    });
    const again = await request(worker, denis, {
      method: "POST",
      path: `/api/commands/${draftIdOf(outcome)}/create`,
    });
    const [task] = await tasks(worker, asya);

    expect(created.status).toBe(201);
    expect(await created.json<DraftCreated>()).toEqual({ kind: "task", id: task?.id });
    expect(task).toMatchObject({ title: "Оплатить интернет", recipients: "default" });
    expect(again.status).toBe(404);
  });

  test("names why «Создать» was refused and keeps the draft open", async () => {
    const worker = await startWithFamily();

    worker.ai.hear(phrase);
    worker.ai.answer({ response: { ...internet, recipientIds: [worker.asyaId] } });

    const outcome = await recorded(worker, denis);

    await request(worker, denis, {
      method: "DELETE",
      path: `/api/family/members/${worker.asyaId}`,
    });

    const refused = await request(worker, denis, {
      method: "POST",
      path: `/api/commands/${draftIdOf(outcome)}/create`,
    });
    const opened = await request(worker, denis, { path: `/api/commands/${draftIdOf(outcome)}` });

    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ code: "RECIPIENTS_NOT_ALLOWED" });
    expect(opened.status).toBe(200);
  });

  test("answers a failure with the bot's words and counts it towards the limit", async () => {
    const worker = await startWithFamily();

    worker.ai.hear("");

    const silence = await recorded(worker, denis);

    worker.ai.hear(phrase);
    worker.ai.answer({ response: { outcome: "unsupported" } });

    const refused = await recorded(worker, denis);

    worker.ai.hear(phrase);
    worker.ai.answer({ response: internet });
    await record(worker, denis);

    const over = await recorded(worker, denis);

    expect(silence).toEqual({
      status: "unheard",
      heard: null,
      message: "Не расслышал, попробуйте ещё раз.",
    });
    expect(refused).toMatchObject({ status: "unsupported", heard: phrase });
    expect(over).toMatchObject({ status: "quota", message: expect.stringMatching(/^На сегодня/u) });
    expect(worker.ai.calls).toHaveLength(5);
  });

  test("refuses a recording too large or not audio without asking Whisper", async () => {
    const worker = await startWithFamily();

    const large = await record(worker, denis, { length: 3_000_000 });
    const text = await record(worker, denis, { type: "text/plain" });

    expect(large.status).toBe(413);
    expect(text.status).toBe(415);
    expect(worker.ai.calls).toEqual([]);
  });

  test("picks a candidate and drops a draft on «×»", async () => {
    const worker = await startWithFamily();
    const mother = await worker.addMember(worker.familyId, { telegramId: 333, name: "Ася" });

    worker.ai.hear(phrase);
    worker.ai.answer({
      response: {
        ...internet,
        ambiguities: [
          { field: "recipients", mention: "Ася", candidateIds: [worker.asyaId, mother] },
        ],
      },
    });

    const draftId = draftIdOf(await recorded(worker, denis));
    const picked = await request(worker, denis, {
      method: "POST",
      path: `/api/commands/${draftId}/pick`,
      body: { index: 1 },
    });
    const dismissed = await request(worker, denis, {
      method: "POST",
      path: `/api/commands/${draftId}/dismiss`,
    });
    const opened = await request(worker, denis, { path: `/api/commands/${draftId}` });

    expect(await picked.json<CommandOutcome>()).toMatchObject({
      status: "draft",
      draft: { ambiguities: [], recipientIds: [mother] },
    });
    expect(dismissed.status).toBe(200);
    expect(opened.status).toBe(404);
  });

  test("keeps a Member's draft from everyone else", async () => {
    const worker = await startWithFamily();

    worker.ai.hear(phrase);
    worker.ai.answer({ response: internet });

    const draftId = draftIdOf(await recorded(worker, denis));
    const opened = await request(worker, asya, { path: `/api/commands/${draftId}` });
    const created = await request(worker, asya, {
      method: "POST",
      path: `/api/commands/${draftId}/create`,
    });

    expect(opened.status).toBe(404);
    expect(created.status).toBe(404);
    expect(await tasks(worker, denis)).toEqual([]);
  });
});

test("points a Member without a microphone at the bot chat", async () => {
  const worker = await startWithFamily();
  const response = await request(worker, denis, { path: "/api/commands/bot" });

  expect(await response.json()).toEqual({ url: "https://t.me/family_hub_test_bot" });
});

describe("a bot draft opened in the Mini App by «Изменить»", () => {
  test("opens the draft and, once the form saved it, settles the bot's preview", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: { ...internet, title: null, missing: ["title"] } });
    await say(worker, denis, "напомни в пятницу в 19:00");

    const preview = lastTo(worker, denis);
    const button = buttonsOf(preview).find((each) => each.text === "Изменить");
    const draftId = draftIdInLink(button !== undefined && "url" in button ? button.url : "");
    const opened = await request(worker, denis, { path: `/api/commands/${draftId}` });

    expect(await opened.json<CommandOutcome>()).toMatchObject({
      status: "draft",
      draft: { title: null, time: "19:00", missing: ["title"] },
    });

    await request(worker, denis, { method: "POST", path: `/api/commands/${draftId}/created` });

    expect(worker.bot.editedMessages().at(-1)?.text).toMatch(/^✅ Создано/u);
    const settled = await request(worker, denis, { path: `/api/commands/${draftId}` });

    expect(settled.status).toBe(404);
  });

  test("tells when and in which zone the phrase was said, however late and wherever it opens", async () => {
    const worker = await startWithFamily();

    worker.ai.answer({ response: internet });
    await say(worker, denis, phrase);

    const preview = lastTo(worker, denis);
    const button = buttonsOf(preview).find((each) => each.text === "Изменить");
    const draftId = draftIdInLink(button !== undefined && "url" in button ? button.url : "");

    worker.clock.set("2026-10-13T19:00:01Z");
    await request(worker, denis, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Asia/Vladivostok", isAuto: true },
    });
    const opened = await request(worker, denis, { path: `/api/commands/${draftId}` });

    expect(await opened.json<CommandOutcome>()).toMatchObject({
      status: "draft",
      phrase: { saidAt: Date.parse("2026-10-13T09:00:01Z"), timeZone: "Europe/Moscow" },
    });
  });
});
