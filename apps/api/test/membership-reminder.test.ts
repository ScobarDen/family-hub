import { describe, expect, test } from "vite-plus/test";

import type {
  CalendarEvent,
  EventChange,
  InviteCreated,
  Pet,
  PlanChange,
  ReminderChange,
} from "@family-hub/contract";

import { signInitData, type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker } from "./worker-harness.ts";

const call: EventChange = {
  title: "Созвон с родителями",
  note: null,
  start: { date: "2026-10-10", time: "19:00", timeZone: "Europe/Moscow" },
  end: null,
  recurrence: null,
  visibility: "shared",
  reminderOffsets: ["1h"],
};

const ceiling: PlanChange = {
  title: "Покрасить потолок",
  note: null,
  dueDate: "2026-10-20",
  reminder: "on-day",
  assigneeId: null,
  visibility: "shared",
  petId: null,
  albumId: null,
};

const internet: ReminderChange = {
  text: "Оплатить интернет",
  start: { date: "2026-10-05", time: "13:00", timeZone: "Europe/Moscow" },
  recurrence: null,
  visibility: "shared",
  recipientIds: null,
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

async function createEvent(worker: Worker, change: Partial<EventChange> = {}) {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/events",
    body: { ...call, ...change },
  });

  return response.json<CalendarEvent>();
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

async function createPlan(worker: Worker, change: Partial<PlanChange> = {}) {
  await request(worker, denis, {
    method: "POST",
    path: "/api/plans",
    body: { ...ceiling, ...change },
  });
}

async function createReminder(worker: Worker, change: Partial<ReminderChange> = {}) {
  await request(worker, denis, {
    method: "POST",
    path: "/api/reminders",
    body: { ...internet, ...change },
  });
}

function textsTo(worker: Worker, user: TelegramUserFixture, emoji: string) {
  return worker.bot
    .sentMessages()
    .filter(({ chat_id: chatId, text }) => chatId === user.id && text.startsWith(emoji))
    .map(({ text }) => text);
}

function remindersTo(worker: Worker, user: TelegramUserFixture) {
  return ["🔔", "📅", "🎂", "💉", "📌"].flatMap((emoji) => textsTo(worker, user, emoji));
}

async function tickAt(worker: Worker, moment: string) {
  worker.clock.set(moment);
  await worker.tick();
}

describe("a Member who joins by Invite", () => {
  test("gets the next Occurrence of a Shared Event", async () => {
    const worker = await startWithDenis();

    await createEvent(worker);
    await joinByInvite(worker, asya);
    await tickAt(worker, "2026-10-10T15:00:00Z");

    expect(textsTo(worker, asya, "📅")).toEqual(["📅 Созвон с родителями · 10 октября, 19:00"]);
  });

  test("gets a Pet's birthday", async () => {
    const worker = await startWithDenis();

    await addBuick(worker);
    await joinByInvite(worker, asya);
    await tickAt(worker, "2026-10-20T06:00:00Z");

    expect(textsTo(worker, asya, "🎂")).toEqual(["🎂 Сегодня день рождения у Бьюик!"]);
  });

  test("gets a Due Date", async () => {
    const worker = await startWithDenis();
    const buick = await addBuick(worker);

    await request(worker, denis, {
      method: "POST",
      path: `/api/pets/${buick.id}/care-entries`,
      body: {
        occurredAt: worker.clock.now(),
        note: null,
        details: { kind: "vaccination", vaccine: "Нобивак", cost: null, dueDate: "2026-10-15" },
      },
    });
    await joinByInvite(worker, asya);
    await tickAt(worker, "2026-10-08T06:00:00Z");

    expect(textsTo(worker, asya, "💉")).toEqual(["💉 Прививка: Нобивак — Бьюик: срок 15 октября"]);
  });

  test("gets a Plan's deadline", async () => {
    const worker = await startWithDenis();

    await createPlan(worker);
    await joinByInvite(worker, asya);
    await tickAt(worker, "2026-10-20T06:00:00Z");

    expect(textsTo(worker, asya, "📌")).toEqual(["📌 Покрасить потолок · до 20 октября"]);
  });

  test("gets a Reminder for everyone", async () => {
    const worker = await startWithDenis();

    await createReminder(worker);
    await joinByInvite(worker, asya);
    await tickAt(worker, "2026-10-05T10:00:00Z");

    expect(textsTo(worker, asya, "🔔")).toEqual(["🔔 Оплатить интернет"]);
  });

  test("is left out of a Reminder with chosen Recipients", async () => {
    const worker = await startWithDenis();

    await createReminder(worker, { recipientIds: [worker.denisId] });
    await joinByInvite(worker, asya);
    await tickAt(worker, "2026-10-05T10:00:00Z");

    expect(textsTo(worker, denis, "🔔")).toEqual(["🔔 Оплатить интернет"]);
    expect(textsTo(worker, asya, "🔔")).toEqual([]);
  });

  test("gets nothing of the others' Private records", async () => {
    const worker = await startWithDenis();

    await createEvent(worker, { visibility: "private" });
    await createPlan(worker, { visibility: "private" });
    await createReminder(worker, { visibility: "private", recipientIds: [worker.denisId] });
    await joinByInvite(worker, asya);

    for (const moment of ["2026-10-05T10:00:00Z", "2026-10-10T15:00:00Z", "2026-10-20T06:00:00Z"]) {
      await tickAt(worker, moment);
    }

    expect(remindersTo(worker, denis)).toHaveLength(3);
    expect(remindersTo(worker, asya)).toEqual([]);
  });

  test("leaves the snoozes of those already in the Family as they were", async () => {
    const worker = await startWithDenis();

    await createReminder(worker);
    await tickAt(worker, "2026-10-05T10:00:00Z");

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
    await tickAt(worker, "2026-10-05T11:00:00Z");

    expect(textsTo(worker, denis, "🔔")).toEqual(["🔔 Оплатить интернет", "🔔 Оплатить интернет"]);
  });
});

describe("a Member who is no longer in the Family", () => {
  test("gets none of its Reminders after leaving", async () => {
    const worker = await startWithAsya();

    await createEvent(worker);
    await addBuick(worker);
    await createPlan(worker);
    await createReminder(worker, { recipientIds: [worker.denisId, worker.asyaId] });
    await request(worker, asya, { method: "POST", path: "/api/family/leave" });

    for (const moment of ["2026-10-05T10:00:00Z", "2026-10-10T15:00:00Z", "2026-10-20T06:00:00Z"]) {
      await tickAt(worker, moment);
    }

    expect(remindersTo(worker, denis)).toHaveLength(4);
    expect(remindersTo(worker, asya)).toEqual([]);
  });

  test("gets none of its Reminders after the Family Owner removed them", async () => {
    const worker = await startWithAsya();

    await createEvent(worker);
    await createReminder(worker);
    await request(worker, denis, {
      method: "DELETE",
      path: `/api/family/members/${worker.asyaId}`,
    });

    for (const moment of ["2026-10-05T10:00:00Z", "2026-10-10T15:00:00Z"]) {
      await tickAt(worker, moment);
    }

    expect(textsTo(worker, asya, "🔔")).toEqual([]);
    expect(textsTo(worker, asya, "📅")).toEqual([]);
  });

  test("hands the Plan they were assigned to the whole Family's Reminders", async () => {
    const worker = await startWithAsya();

    await createPlan(worker, { assigneeId: worker.asyaId });
    await request(worker, asya, { method: "POST", path: "/api/family/leave" });
    await tickAt(worker, "2026-10-20T06:00:00Z");

    expect(textsTo(worker, denis, "📌")).toEqual(["📌 Покрасить потолок · до 20 октября"]);
    expect(textsTo(worker, asya, "📌")).toEqual([]);
  });

  test("gets none of its Reminders in the next Family even if the old one kept their rows", async () => {
    const worker = await startWithAsya();
    const ivan = { id: 333, first_name: "Иван" };

    await createReminder(worker);
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
    await tickAt(worker, "2026-10-05T10:00:00Z");

    expect(textsTo(worker, denis, "🔔")).toEqual(["🔔 Оплатить интернет"]);
    expect(textsTo(worker, asya, "🔔")).toEqual([]);
  });
});
