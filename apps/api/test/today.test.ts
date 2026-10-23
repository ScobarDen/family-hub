import { describe, expect, test } from "vite-plus/test";

import type { CareDetails, Pet, Today, TodayTiles } from "@family-hub/contract";

import type { TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker, tokenOf } from "./worker-harness.ts";

async function startWithFamily() {
  const worker = startWorker({ now: "2026-10-02T05:00:00Z" });
  const { familyId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  for (const user of [denis, asya]) {
    await request(worker, user, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Europe/Moscow", isAuto: true },
    });
  }

  return Object.assign(worker, { familyId });
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

async function todayOf(worker: Worker, user: TelegramUserFixture = denis): Promise<Today> {
  const response = await request(worker, user, { path: "/api/today" });

  return response.json<Today>();
}

async function addPlan(
  worker: Worker,
  user: TelegramUserFixture,
  {
    title,
    dueDate = null,
    visibility = "shared",
  }: { title: string; dueDate?: string | null; visibility?: string },
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

async function addEvent(worker: Worker, { title, date }: { title: string; date: string }) {
  await request(worker, denis, {
    method: "POST",
    path: "/api/events",
    body: {
      title,
      note: null,
      start: { date, time: "19:00", timeZone: "Europe/Moscow" },
      end: null,
      recurrence: null,
      visibility: "shared",
      reminderOffsets: [],
    },
  });
}

async function addPet(worker: Worker, name: string): Promise<Pet> {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/pets",
    body: {
      name,
      species: "dog",
      breed: null,
      sex: null,
      birthDate: null,
      chipNumber: null,
      notes: null,
    },
  });

  return response.json<Pet>();
}

async function vaccinate(
  worker: Worker,
  pet: Pet,
  { vaccine, dueDate }: { vaccine: string; dueDate: string },
) {
  const details: CareDetails = { kind: "vaccination", vaccine, cost: null, dueDate };

  await request(worker, denis, {
    method: "POST",
    path: `/api/pets/${pet.id}/care-entries`,
    body: { occurredAt: Date.parse("2025-10-01T10:00:00Z"), note: null, details },
  });
}

async function tileOf<Section extends keyof TodayTiles>(
  worker: Worker,
  section: Section,
  user: TelegramUserFixture = denis,
): Promise<TodayTiles[Section]> {
  const { tiles } = await todayOf(worker, user);

  return tiles[section];
}

async function addGoal(worker: Worker, user: TelegramUserFixture, body: Record<string, unknown>) {
  const response = await request(worker, user, {
    method: "POST",
    path: "/api/goals",
    body: {
      target: 100_000,
      deadline: null,
      icon: "palmtree",
      color: "teal",
      note: null,
      visibility: "shared",
      ...body,
    },
  });

  return response.json<{ id: string }>();
}

async function addRecipe(worker: Worker, title: string) {
  const response = await request(worker, denis, {
    method: "POST",
    path: "/api/recipes",
    body: { title, ingredients: "", method: null },
  });

  return response.json<{ id: string }>();
}

// Each photo is a different file, so the channel keeps all three.
async function upload(worker: Worker, at: string, size: number) {
  const form = new FormData();

  worker.clock.set(at);
  form.append("file", new Blob([new Uint8Array(size)]), "photo.jpg");
  await worker.request("/api/photos", {
    method: "POST",
    headers: { authorization: `Bearer ${await tokenOf(worker, asya)}` },
    body: form,
  });
}

describe("«Сделать сегодня»", () => {
  test("is empty on a day with nothing to do", async () => {
    const worker = await startWithFamily();

    const { due, next } = await todayOf(worker);

    expect(due).toEqual([]);
    expect(next).toEqual([]);
  });

  test("lists Overdue Plans and Due Dates oldest first, then what is due today", async () => {
    const worker = await startWithFamily();
    const buick = await addPet(worker, "Бьюик");

    await addPlan(worker, denis, { title: "Купить корм", dueDate: "2026-10-02" });
    await vaccinate(worker, buick, { vaccine: "Бешенство", dueDate: "2026-09-30" });
    await addPlan(worker, denis, { title: "Отправить документы", dueDate: "2026-09-28" });

    const { due } = await todayOf(worker);

    expect(due.map(({ kind, title, date }) => ({ kind, title, date }))).toEqual([
      { kind: "plan", title: "Отправить документы", date: "2026-09-28" },
      { kind: "due", title: "Прививка: Бешенство — Бьюик", date: "2026-09-30" },
      { kind: "plan", title: "Купить корм", date: "2026-10-02" },
    ]);
  });

  test("holds every item of a bad week, not just the three shown", async () => {
    const worker = await startWithFamily();

    for (let day = 10; day >= 1; day -= 1) {
      await addPlan(worker, denis, { title: `Дело ${day}`, dueDate: `2026-09-${10 + day}` });
    }

    const { due } = await todayOf(worker);

    expect(due).toHaveLength(10);
    expect(due[0]).toMatchObject({ title: "Дело 1", date: "2026-09-11" });
  });

  test("lists today's Events and Reminders, not yesterday's", async () => {
    const worker = await startWithFamily();

    await addEvent(worker, { title: "Созвон", date: "2026-10-02" });
    await addEvent(worker, { title: "Вчерашний созвон", date: "2026-10-01" });
    await request(worker, asya, {
      method: "POST",
      path: "/api/reminders",
      body: {
        text: "Оплатить интернет",
        start: { date: "2026-10-02", time: "10:00", timeZone: "Europe/Moscow" },
        recurrence: null,
        visibility: "shared",
        recipientIds: null,
      },
    });

    const { due, next } = await todayOf(worker);

    expect(due.map(({ kind, title }) => ({ kind, title }))).toEqual([
      { kind: "reminder", title: "Оплатить интернет" },
      { kind: "event", title: "Созвон" },
    ]);
    expect(next).toEqual([]);
  });

  test("lists what the morning digest sends", async () => {
    const worker = await startWithFamily();
    const buick = await addPet(worker, "Бьюик");

    await addPlan(worker, denis, { title: "Отправить документы", dueDate: "2026-09-28" });
    await vaccinate(worker, buick, { vaccine: "Бешенство", dueDate: "2026-10-02" });
    await addEvent(worker, { title: "Созвон", date: "2026-10-02" });
    worker.clock.set("2026-10-02T06:00:00Z");
    await worker.tick();

    const { due } = await todayOf(worker);
    const messages = worker.bot.sentMessages();
    const digest = messages.find(({ chat_id: chatId }) => chatId === denis.id);
    const digestLines = digest?.text.split("\n").filter((line) => line.startsWith("• ")) ?? [];

    expect(due.map(({ title }) => title)).toEqual([
      "Отправить документы",
      "Прививка: Бешенство — Бьюик",
      "Созвон",
    ]);
    expect(
      digestLines.filter((line) => due.some(({ title }) => line.includes(title))),
    ).toHaveLength(due.length);
    expect(digestLines).toHaveLength(due.length);
  });

  test("shows a Private Plan only to its owner", async () => {
    const worker = await startWithFamily();

    await addPlan(worker, asya, {
      title: "Подарок Денису",
      dueDate: "2026-10-02",
      visibility: "private",
    });

    const forDenis = await todayOf(worker, denis);
    const forAsya = await todayOf(worker, asya);

    expect(forDenis.due).toEqual([]);
    expect(forAsya.due.map(({ title }) => title)).toEqual(["Подарок Денису"]);
  });
});

describe("«Дальше»", () => {
  test("shows the next three Upcoming from today on, leaving out what is already to do", async () => {
    const worker = await startWithFamily();

    await addPlan(worker, denis, { title: "Купить корм", dueDate: "2026-10-02" });
    await addEvent(worker, { title: "Созвон", date: "2026-10-02" });
    await addEvent(worker, { title: "Театр", date: "2026-10-05" });
    await addPlan(worker, denis, { title: "Записаться к врачу", dueDate: "2026-10-04" });
    await addEvent(worker, { title: "Концерт", date: "2026-10-09" });

    const { next } = await todayOf(worker);

    expect(next.map(({ title, date }) => ({ title, date }))).toEqual([
      { title: "Записаться к врачу", date: "2026-10-04" },
      { title: "Театр", date: "2026-10-05" },
      { title: "Концерт", date: "2026-10-09" },
    ]);
  });
});

describe("the section tiles", () => {
  test("count nothing in a new Family", async () => {
    const worker = await startWithFamily();

    const { tiles } = await todayOf(worker);

    expect(tiles).toEqual({
      plans: { open: 0, overdue: 0 },
      calendar: { events: 0 },
      pet: { activeCount: 0, only: null, due: null },
      goals: { nearest: null },
      albums: { photos: 0 },
      recipes: { lastCooked: null },
    });
  });

  test("count open Plans with the Overdue ones, and only the viewer's own Private ones", async () => {
    const worker = await startWithFamily();

    await addPlan(worker, denis, { title: "Отправить документы", dueDate: "2026-09-28" });
    await addPlan(worker, denis, { title: "Купить корм", dueDate: "2026-10-02" });
    await addPlan(worker, asya, { title: "Подарок Денису", visibility: "private" });

    expect(await tileOf(worker, "plans", denis)).toEqual({ open: 2, overdue: 1 });
    expect(await tileOf(worker, "plans", asya)).toEqual({ open: 3, overdue: 1 });
  });

  test("count the Events of the next seven days", async () => {
    const worker = await startWithFamily();

    await addEvent(worker, { title: "Созвон", date: "2026-10-02" });
    await addEvent(worker, { title: "Театр", date: "2026-10-08" });
    await addEvent(worker, { title: "Концерт", date: "2026-10-09" });

    expect(await tileOf(worker, "calendar")).toEqual({ events: 2 });
  });

  test("name the only Pet in care and leave out an Archived one with its Overdue Due Date", async () => {
    const worker = await startWithFamily();
    const buick = await addPet(worker, "Бьюик");
    const old = await addPet(worker, "Рыжик");

    await vaccinate(worker, old, { vaccine: "Бешенство", dueDate: "2026-09-01" });
    await vaccinate(worker, buick, { vaccine: "Бешенство", dueDate: "2026-11-01" });
    await request(worker, denis, { method: "POST", path: `/api/pets/${old.id}/archive` });

    expect(await tileOf(worker, "pet")).toEqual({
      activeCount: 1,
      only: { petId: buick.id, name: "Бьюик", picture: null },
      due: { label: "Прививка: Бешенство", date: "2026-11-01" },
    });
  });

  test("count several Pets with the soonest Due Date of them all, naming its Pet", async () => {
    const worker = await startWithFamily();
    const buick = await addPet(worker, "Бьюик");
    const murka = await addPet(worker, "Мурка");

    await vaccinate(worker, buick, { vaccine: "Бешенство", dueDate: "2026-11-01" });
    await vaccinate(worker, murka, { vaccine: "Нобивак", dueDate: "2026-10-20" });

    expect(await tileOf(worker, "pet")).toEqual({
      activeCount: 2,
      only: null,
      due: { label: "Прививка: Нобивак — Мурка", date: "2026-10-20" },
    });
  });

  test("show the progress of the nearest-deadline Goal that is not completed", async () => {
    const worker = await startWithFamily();

    const sofa = await addGoal(worker, denis, { title: "Диван", deadline: "2026-12-01" });

    await addGoal(worker, denis, { title: "Отпуск", deadline: "2027-06-01" });
    await addGoal(worker, asya, {
      title: "Сюрприз",
      deadline: "2026-11-01",
      visibility: "private",
    });
    await request(worker, denis, {
      method: "POST",
      path: `/api/goals/${sofa.id}/movements`,
      body: { kind: "contribution", amount: 25_500, date: "2026-10-01", comment: null },
    });

    expect(await tileOf(worker, "goals", denis)).toEqual({
      nearest: { goalId: sofa.id, title: "Диван", percent: 25 },
    });
    expect(await tileOf(worker, "goals", asya)).toMatchObject({ nearest: { title: "Сюрприз" } });
  });

  test("count the photos added in the last seven days", async () => {
    const worker = await startWithFamily();

    await worker.setPhotoChannel(worker.familyId, -100_500);
    await upload(worker, "2026-09-24T12:00:00Z", 10);
    await upload(worker, "2026-09-26T12:00:00Z", 20);
    await upload(worker, "2026-10-01T12:00:00Z", 30);
    worker.clock.set("2026-10-02T05:00:00Z");

    expect(await tileOf(worker, "albums")).toEqual({ photos: 2 });
  });

  test("show the Recipe cooked last", async () => {
    const worker = await startWithFamily();

    const lasagna = await addRecipe(worker, "Лазанья");
    const borscht = await addRecipe(worker, "Борщ");

    for (const [recipe, at] of [
      [borscht, "2026-09-30T18:00:00Z"],
      [lasagna, "2026-09-20T18:00:00Z"],
    ] as const) {
      await request(worker, denis, {
        method: "POST",
        path: `/api/recipes/${recipe.id}/cooked`,
        body: { cookedAt: Date.parse(at) },
      });
    }

    expect(await tileOf(worker, "recipes")).toEqual({
      lastCooked: { recipeId: borscht.id, title: "Борщ" },
    });
  });
});

test("needs a session", async () => {
  const worker = await startWithFamily();

  const response = await worker.request("/api/today");

  expect(response.status).toBe(401);
});
