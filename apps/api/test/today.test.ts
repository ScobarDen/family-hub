import { describe, expect, test } from "vite-plus/test";

import type { Pet, Task, TaskChange, Today, TodayTiles } from "@family-hub/contract";

import type { TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker, tokenOf } from "./worker-harness.ts";

async function startWithFamily() {
  const worker = startWorker({ now: "2026-10-02T05:00:00Z" });
  const { familyId, ownerId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });
  const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  for (const user of [denis, asya]) {
    await request(worker, user, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Europe/Moscow", isAuto: true },
    });
  }

  return Object.assign(worker, { familyId, denisId: ownerId, asyaId });
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

async function todayOf(worker: Worker, user: TelegramUserFixture = denis): Promise<Today> {
  const response = await request(worker, user, { path: "/api/today" });

  return response.json<Today>();
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

async function addTask(
  worker: Worker,
  change: TaskChange,
  user: TelegramUserFixture = denis,
): Promise<Task> {
  const response = await request(worker, user, {
    method: "POST",
    path: "/api/tasks",
    body: change,
  });

  return response.json<Task>();
}

async function addAssigned(worker: Worker, { title, date }: { title: string; date: string }) {
  return addTask(worker, { title, when: on(date), assigneeIds: [worker.denisId] });
}

async function complete(
  worker: Worker,
  { taskId, occurrence }: { taskId: string; occurrence: string | null },
) {
  await request(worker, asya, {
    method: "POST",
    path: `/api/tasks/${taskId}/complete`,
    body: { occurrence },
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

  test("lists Overdue Tasks with Assignees oldest first, then what is due today", async () => {
    const worker = await startWithFamily();
    const buick = await addPet(worker, "Бьюик");

    await addAssigned(worker, { title: "Купить корм", date: "2026-10-02" });
    await addTask(worker, {
      title: "Прививка от бешенства",
      when: on("2026-09-30"),
      assigneeIds: [worker.denisId],
      petId: buick.id,
    });
    await addTask(worker, { title: "ДР бабушки", when: on("2026-09-29") });
    await addAssigned(worker, { title: "Отправить документы", date: "2026-09-28" });

    const { due } = await todayOf(worker);

    expect(due.map(({ title, date }) => ({ title, date }))).toEqual([
      { title: "Отправить документы", date: "2026-09-28" },
      { title: "Прививка от бешенства — Бьюик", date: "2026-09-30" },
      { title: "Купить корм", date: "2026-10-02" },
    ]);
  });

  test("holds every item of a bad week, not just the three shown", async () => {
    const worker = await startWithFamily();

    for (let day = 10; day >= 1; day -= 1) {
      await addAssigned(worker, { title: `Дело ${day}`, date: `2026-09-${10 + day}` });
    }

    const { due } = await todayOf(worker);

    expect(due).toHaveLength(10);
    expect(due[0]).toMatchObject({ title: "Дело 1", date: "2026-09-11" });
  });

  test("lists today's Tasks without Assignees by time, not yesterday's", async () => {
    const worker = await startWithFamily();

    await addTask(worker, { title: "Созвон", when: on("2026-10-02", "19:00") });
    await addTask(worker, { title: "Вчерашний созвон", when: on("2026-10-01", "19:00") });
    await addTask(
      worker,
      {
        title: "Оплатить интернет",
        when: on("2026-10-02", "10:00"),
        reminderOffsets: ["at-start"],
      },
      asya,
    );

    const { due, next } = await todayOf(worker);

    expect(due.map(({ title }) => title)).toEqual(["Оплатить интернет", "Созвон"]);
    expect(next).toEqual([]);
  });

  test("lists what the morning digest sends", async () => {
    const worker = await startWithFamily();
    const buick = await addPet(worker, "Бьюик");

    await addAssigned(worker, { title: "Отправить документы", date: "2026-09-28" });
    await addTask(worker, {
      title: "Прививка от бешенства",
      when: on("2026-10-02"),
      assigneeIds: [worker.denisId],
      petId: buick.id,
    });
    await addTask(worker, { title: "Созвон", when: on("2026-10-02", "19:00") });
    worker.clock.set("2026-10-02T06:00:00Z");
    await worker.tick();

    const { due } = await todayOf(worker);
    const messages = worker.bot.sentMessages();
    const digest = messages.find(
      ({ chat_id: chatId, text }) => chatId === denis.id && text.startsWith("☀️"),
    );
    const digestLines = digest?.text.split("\n").filter((line) => line.startsWith("• ")) ?? [];

    expect(due.map(({ title }) => title)).toEqual([
      "Отправить документы",
      "Прививка от бешенства — Бьюик",
      "Созвон",
    ]);
    expect(
      digestLines.filter((line) => due.some(({ title }) => line.includes(title))),
    ).toHaveLength(due.length);
    expect(digestLines).toHaveLength(due.length);
  });

  test("shows a Private Task only to its owner", async () => {
    const worker = await startWithFamily();

    await addTask(
      worker,
      { title: "Подарок Денису", when: on("2026-10-02"), visibility: "private" },
      asya,
    );

    const forDenis = await todayOf(worker, denis);
    const forAsya = await todayOf(worker, asya);

    expect(forDenis.due).toEqual([]);
    expect(forAsya.due.map(({ title }) => title)).toEqual(["Подарок Денису"]);
  });
});

describe("«Дальше»", () => {
  test("shows the next three Upcoming from today on, leaving out what is already to do", async () => {
    const worker = await startWithFamily();

    await addAssigned(worker, { title: "Купить корм", date: "2026-10-02" });
    await addTask(worker, { title: "Созвон", when: on("2026-10-02", "19:00") });
    await addTask(worker, { title: "Театр", when: on("2026-10-05", "19:00") });
    await addAssigned(worker, { title: "Записаться к врачу", date: "2026-10-04" });
    await addTask(worker, { title: "Концерт", when: on("2026-10-09", "19:00") });

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
      tasks: { open: 0, overdue: 0, week: 0 },
      pet: { activeCount: 0, only: null },
      goals: { nearest: null },
      albums: { photos: 0 },
      recipes: { lastCooked: null },
    });
  });

  test("count open Tasks, the Overdue ones with Assignees and those of the next seven days", async () => {
    const worker = await startWithFamily();
    const bought = await addTask(worker, { title: "Купить пылесос" });

    await complete(worker, { taskId: bought.id, occurrence: null });
    await addAssigned(worker, { title: "Отправить документы", date: "2026-09-28" });
    await addTask(worker, { title: "ДР бабушки", when: on("2026-09-29") });
    await addAssigned(worker, { title: "Купить корм", date: "2026-10-02" });
    await addTask(worker, { title: "Театр", when: on("2026-10-08", "19:00") });
    await addTask(worker, { title: "Концерт", when: on("2026-10-09", "19:00") });

    expect(await tileOf(worker, "tasks")).toEqual({ open: 5, overdue: 1, week: 2 });
  });

  test("count a recurring Task by its Occurrences", async () => {
    const worker = await startWithFamily();
    const pill = await addTask(worker, {
      title: "Таблетка Бьюику",
      when: on("2026-09-24"),
      recurrence: { frequency: "weekly", until: null },
      assigneeIds: [worker.asyaId],
    });

    await complete(worker, { taskId: pill.id, occurrence: "2026-09-24" });

    expect(await tileOf(worker, "tasks")).toEqual({ open: 1, overdue: 1, week: 1 });
  });

  test("count only the viewer's own Private Tasks", async () => {
    const worker = await startWithFamily();

    await addTask(worker, { title: "Купить корм" });
    await addTask(
      worker,
      {
        title: "Подарок Денису",
        when: on("2026-09-28"),
        assigneeIds: [worker.asyaId],
        visibility: "private",
      },
      asya,
    );

    expect(await tileOf(worker, "tasks", denis)).toEqual({ open: 1, overdue: 0, week: 0 });
    expect(await tileOf(worker, "tasks", asya)).toEqual({ open: 2, overdue: 1, week: 0 });
  });

  test("name the only Pet in care and leave out an Archived one", async () => {
    const worker = await startWithFamily();
    const buick = await addPet(worker, "Бьюик");
    const old = await addPet(worker, "Рыжик");

    await request(worker, denis, { method: "POST", path: `/api/pets/${old.id}/archive` });

    expect(await tileOf(worker, "pet")).toEqual({
      activeCount: 1,
      only: { petId: buick.id, name: "Бьюик", picture: null },
    });
  });

  test("count several Pets without naming one", async () => {
    const worker = await startWithFamily();

    await addPet(worker, "Бьюик");
    await addPet(worker, "Мурка");

    expect(await tileOf(worker, "pet")).toEqual({ activeCount: 2, only: null });
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
