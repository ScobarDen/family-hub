import { describe, expect, test } from "vite-plus/test";

import type { InviteCreated, Pet, Task, TaskChange, TaskList } from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker } from "./worker-harness.ts";

const call: TaskChange = {
  title: "Созвон с родителями",
  when: {
    date: "2026-10-10",
    time: "19:00",
    timeZone: "Europe/Moscow",
    endDate: null,
    endTime: null,
  },
  reminderOffsets: ["1h"],
  recipients: "everyone",
};

const internet: TaskChange = {
  title: "Оплатить интернет",
  when: { date: "2026-10-05", time: null, timeZone: null, endDate: null, endTime: null },
  reminderOffsets: ["at-start"],
  recipients: "everyone",
};

function initDataOf(worker: ReturnType<typeof startWorker>, user: TelegramUserFixture) {
  return signInitData({ botToken: worker.env.BOT_TOKEN, user, authDate: worker.clock.iso() });
}

async function setMoscowZone(worker: ReturnType<typeof startWorker>, user: TelegramUserFixture) {
  await request(worker, user, {
    method: "PUT",
    path: "/api/me/time-zone",
    body: { timeZone: "Europe/Moscow", isAuto: true },
  });
}

async function startWithDenis() {
  const worker = startWorker({ now: "2026-10-01T09:00:00Z" });
  const { familyId, ownerId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  await setMoscowZone(worker, denis);

  return Object.assign(worker, { familyId, denisId: ownerId });
}

type Worker = Awaited<ReturnType<typeof startWithDenis>>;

async function joinByInvite(worker: Worker, user: TelegramUserFixture) {
  const response = await request(worker, denis, { method: "POST", path: "/api/invites" });
  const { link } = await response.json<InviteCreated>();
  const token = new URL(link).searchParams.get("startapp")?.replace(/^inv_/, "") ?? "";

  await worker.request(`/api/invites/${token}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData: initDataOf(worker, user) }),
  });
  await setMoscowZone(worker, user);
}

async function startWithAsya() {
  const worker = await startWithDenis();
  const asyaId = await worker.addMember(worker.familyId, { telegramId: asya.id, name: "Ася" });

  await setMoscowZone(worker, asya);

  return Object.assign(worker, { asyaId });
}

async function createTask(worker: Worker, change: Partial<TaskChange> = {}) {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/tasks",
    body: { ...internet, ...change },
  });

  return response.json<Task>();
}

async function addBuick(worker: Worker) {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/pets",
    body: {
      name: "Бьюик",
      species: "dog",
      breed: null,
      sex: null,
      birthDate: "2022-10-20",
      chipNumber: null,
      notes: null,
    },
  });

  return response.json<Pet>();
}

function textsTo(worker: Worker, user: TelegramUserFixture, emoji: string) {
  return worker.bot
    .sentMessages()
    .filter(({ chat_id: chatId, text }) => chatId === user.id && text.startsWith(emoji))
    .map(({ text }) => text);
}

function remindersTo(worker: Worker, user: TelegramUserFixture) {
  return ["🎂", "📌"].flatMap((emoji) => textsTo(worker, user, emoji));
}

async function tickAt(worker: Worker, moment: string) {
  worker.clock.set(moment);
  await worker.tick();
}

describe("a Member who joins by Invite", () => {
  test("gets the next Occurrence of a timed Task for everyone", async () => {
    const worker = await startWithDenis();

    await createTask(worker, call);
    await joinByInvite(worker, asya);
    await tickAt(worker, "2026-10-10T15:00:00Z");

    expect(textsTo(worker, asya, "📌")).toEqual(["📌 Созвон с родителями · 10 октября, 19:00"]);
  });

  test("gets a date-only Task for everyone", async () => {
    const worker = await startWithDenis();

    await createTask(worker);
    await joinByInvite(worker, asya);
    await tickAt(worker, "2026-10-05T06:00:00Z");

    expect(textsTo(worker, asya, "📌")).toEqual(["📌 Оплатить интернет · 5 октября"]);
  });

  test("gets a Pet's birthday", async () => {
    const worker = await startWithDenis();

    await addBuick(worker);
    await joinByInvite(worker, asya);
    await tickAt(worker, "2026-10-20T06:00:00Z");

    expect(textsTo(worker, asya, "🎂")).toEqual(["🎂 Сегодня день рождения у Бьюик!"]);
  });

  test("is left out of a Task that reminds its author", async () => {
    const worker = await startWithDenis();

    await createTask(worker, { recipients: "default" });
    await joinByInvite(worker, asya);
    await tickAt(worker, "2026-10-05T06:00:00Z");

    expect(textsTo(worker, denis, "📌")).toEqual(["📌 Оплатить интернет · 5 октября"]);
    expect(textsTo(worker, asya, "📌")).toEqual([]);
  });

  test("is left out of a Task with chosen Recipients", async () => {
    const worker = await startWithDenis();

    await createTask(worker, { recipients: [worker.denisId] });
    await joinByInvite(worker, asya);
    await tickAt(worker, "2026-10-05T06:00:00Z");

    expect(textsTo(worker, denis, "📌")).toEqual(["📌 Оплатить интернет · 5 октября"]);
    expect(textsTo(worker, asya, "📌")).toEqual([]);
  });

  test("gets nothing of the others' Private Tasks", async () => {
    const worker = await startWithDenis();

    await createTask(worker, { ...call, visibility: "private" });
    await createTask(worker, { visibility: "private" });
    await joinByInvite(worker, asya);

    for (const moment of ["2026-10-05T06:00:00Z", "2026-10-10T15:00:00Z"]) {
      await tickAt(worker, moment);
    }

    expect(remindersTo(worker, denis)).toHaveLength(2);
    expect(remindersTo(worker, asya)).toEqual([]);
  });

  test("leaves the snoozes of those already in the Family as they were", async () => {
    const worker = await startWithDenis();

    await createTask(worker, call);
    await tickAt(worker, "2026-10-10T15:00:00Z");

    const markup = worker.bot.sentMessages().at(-1)?.reply_markup as
      | { inline_keyboard: Array<Array<{ text: string; callback_data?: string }>> }
      | undefined;
    const snooze = markup?.inline_keyboard.flat().find(({ text }) => text.startsWith("⏰"));

    await worker.webhook({
      update_id: 1,
      callback_query: {
        id: "callback-1",
        from: { ...denis, is_bot: false },
        chat_instance: "instance",
        data: snooze?.callback_data ?? "",
      },
    });
    await joinByInvite(worker, asya);
    await tickAt(worker, "2026-10-10T16:00:00Z");

    expect(textsTo(worker, denis, "📌")).toEqual([
      "📌 Созвон с родителями · 10 октября, 19:00",
      "📌 Созвон с родителями · 10 октября, 19:00",
    ]);
  });
});

describe("a Member who is no longer in the Family", () => {
  test("gets none of its Reminders after leaving", async () => {
    const worker = await startWithAsya();

    await createTask(worker, call);
    await addBuick(worker);
    await createTask(worker, {
      title: "Покрасить потолок",
      when: { date: "2026-10-20", time: null, timeZone: null, endDate: null, endTime: null },
      recipients: "default",
      assigneeIds: [worker.asyaId],
    });
    await createTask(worker, { recipients: [worker.denisId, worker.asyaId] });
    await request(worker, asya, { method: "POST", path: "/api/family/leave" });

    for (const moment of ["2026-10-05T06:00:00Z", "2026-10-10T15:00:00Z", "2026-10-20T06:00:00Z"]) {
      await tickAt(worker, moment);
    }

    expect(remindersTo(worker, denis)).toHaveLength(4);
    expect(remindersTo(worker, asya)).toEqual([]);
  });

  test("gets none of its Reminders after the Family Owner removed them", async () => {
    const worker = await startWithAsya();

    await createTask(worker, call);
    await createTask(worker);
    await request(worker, denis, {
      method: "DELETE",
      path: `/api/family/members/${worker.asyaId}`,
    });

    for (const moment of ["2026-10-05T06:00:00Z", "2026-10-10T15:00:00Z"]) {
      await tickAt(worker, moment);
    }

    expect(textsTo(worker, asya, "📌")).toEqual([]);
  });

  test("stops being an Assignee, so the Task reminds its author instead", async () => {
    const worker = await startWithAsya();
    const ceiling = await createTask(worker, {
      title: "Покрасить потолок",
      when: { date: "2026-10-20", time: null, timeZone: null, endDate: null, endTime: null },
      recipients: "default",
      assigneeIds: [worker.asyaId],
    });

    await request(worker, asya, { method: "POST", path: "/api/family/leave" });
    await tickAt(worker, "2026-10-20T06:00:00Z");

    const response = await request(worker, denis, { path: "/api/tasks" });
    const tasks = await response.json<TaskList>();

    expect(tasks.find(({ id }) => id === ceiling.id)?.assignees).toEqual([]);
    expect(textsTo(worker, denis, "📌")).toEqual(["📌 Покрасить потолок · 20 октября"]);
    expect(textsTo(worker, asya, "📌")).toEqual([]);
  });

  test("gets none of its Reminders in the next Family even if the old one kept their rows", async () => {
    const worker = await startWithAsya();
    const ivan = { id: 333, first_name: "Иван" };

    await createTask(worker);
    await worker.leaveFamily(worker.asyaId);
    await worker.addFamily({ name: "Ивановы", owner: { telegramId: ivan.id, name: "Иван" } });

    const response = await request(worker, ivan, { method: "POST", path: "/api/invites" });
    const { link } = await response.json<InviteCreated>();
    const token = new URL(link).searchParams.get("startapp")?.replace(/^inv_/, "") ?? "";

    await worker.request(`/api/invites/${token}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: initDataOf(worker, asya) }),
    });
    await tickAt(worker, "2026-10-05T06:00:00Z");

    expect(textsTo(worker, denis, "📌")).toEqual(["📌 Оплатить интернет · 5 октября"]);
    expect(textsTo(worker, asya, "📌")).toEqual([]);
  });
});
