import { describe, expect, test } from "vite-plus/test";

import type { FeedPage, Pet, Task, TaskChange } from "@family-hub/contract";

import { type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker } from "./worker-harness.ts";

async function startWithFamily() {
  const worker = startWorker({ now: "2026-10-01T09:00:00Z" });
  const { familyId, ownerId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });

  worker.clock.set("2026-10-01T09:01:00Z");
  const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  for (const user of [denis, asya]) {
    await request(worker, user, {
      method: "PUT",
      path: "/api/me/time-zone",
      body: { timeZone: "Europe/Moscow", isAuto: true },
    });
  }

  return Object.assign(worker, { denisId: ownerId, asyaId });
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

function on(date: string, time: string | null = null): TaskChange["when"] {
  return {
    date,
    time,
    timeZone: time === null ? null : "Europe/Moscow",
    endDate: null,
    endTime: null,
  };
}

async function feedOf(worker: Worker, user: TelegramUserFixture, before?: string) {
  const query = before === undefined ? "" : `?before=${encodeURIComponent(before)}`;
  const response = await request(worker, user, { path: `/api/feed${query}` });

  return response.json<FeedPage>();
}

async function addTask(worker: Worker, user: TelegramUserFixture, change: Partial<TaskChange>) {
  const response = await request(worker, user, {
    method: "POST",
    path: "/api/tasks",
    body: { title: "Ремонт", ...change },
  });

  return response.json<Task>();
}

async function complete(
  worker: Worker,
  user: TelegramUserFixture,
  { taskId, occurrence = null }: { taskId: string; occurrence?: string | null },
) {
  await request(worker, user, {
    method: "POST",
    path: `/api/tasks/${taskId}/complete`,
    body: { occurrence },
  });
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
      birthDate: "2022-10-05",
      chipNumber: null,
      notes: null,
    },
  });

  return response.json<Pet>();
}

async function addEntry(worker: Worker, petId: string, details: Record<string, unknown>) {
  await request(worker, asya, {
    method: "POST",
    path: `/api/pets/${petId}/care-entries`,
    body: { occurredAt: worker.clock.now(), note: null, details },
  });
}

function titles(items: Array<{ title: string }>) {
  return items.map(({ title }) => title);
}

describe("the Feed", () => {
  test("leads with what is overdue, then two weeks ahead in order", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker);

    await addTask(worker, asya, {
      title: "Обработка от клещей",
      when: on("2026-09-25"),
      assigneeIds: [worker.asyaId],
      petId: buick.id,
    });
    await addTask(worker, asya, {
      title: "Прививка от бешенства",
      when: on("2026-10-10"),
      assigneeIds: [worker.asyaId],
      petId: buick.id,
    });
    await addTask(worker, denis, {
      title: "Отправить документы",
      when: on("2026-09-28"),
      assigneeIds: [worker.denisId],
    });
    await addTask(worker, denis, { title: "ДР бабушки", when: on("2026-09-29") });
    await addTask(worker, denis, { title: "Созвон", when: on("2026-10-03", "19:00") });
    await addTask(worker, denis, { title: "Через месяц", when: on("2026-10-30") });
    await addTask(worker, asya, {
      title: "Оплатить интернет",
      when: on("2026-10-02", "10:00"),
      reminderOffsets: ["at-start"],
    });

    const feed = await feedOf(worker, denis);

    expect(titles(feed.overdue)).toEqual(["Обработка от клещей — Бьюик", "Отправить документы"]);
    expect(feed.upcoming.map(({ title, date }) => [title, date])).toEqual([
      ["Оплатить интернет", "2026-10-02"],
      ["Созвон", "2026-10-03"],
      ["День рождения: Бьюик", "2026-10-05"],
      ["Прививка от бешенства — Бьюик", "2026-10-10"],
    ]);
  });

  test("shows a Pet's Task with its Pet and Assignees", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker);
    const task = await addTask(worker, asya, {
      title: "Визит к ветеринару",
      when: on("2026-10-08"),
      assigneeIds: [worker.asyaId],
      petId: buick.id,
    });

    const feed = await feedOf(worker, denis);
    const line = feed.upcoming.find(({ kind }) => kind === "task");

    expect(line).toMatchObject({
      taskId: task.id,
      occurrence: "2026-10-08",
      petId: buick.id,
      assignees: [{ id: worker.asyaId, name: "Ася" }],
    });
  });

  test("shows neither the birthday nor the Overdue Tasks of an archived Pet", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker);

    await addTask(worker, asya, {
      title: "Прививка",
      when: on("2026-10-01"),
      assigneeIds: [worker.asyaId],
      petId: buick.id,
    });
    await request(worker, asya, { method: "POST", path: `/api/pets/${buick.id}/archive` });

    const feed = await feedOf(worker, denis);

    expect(feed.upcoming).toEqual([]);
    expect(feed.overdue).toEqual([]);
  });

  test("keeps Private Tasks for their owner", async () => {
    const worker = await startWithFamily();
    const surprise = await addTask(worker, asya, {
      title: "Сюрприз",
      when: on("2026-10-05"),
      assigneeIds: [worker.asyaId],
      visibility: "private",
    });

    await addTask(worker, asya, {
      title: "Подарок",
      when: on("2026-10-04"),
      visibility: "private",
    });
    await complete(worker, asya, { taskId: surprise.id, occurrence: "2026-10-05" });

    const denisFeed = await feedOf(worker, denis);
    const asyaFeed = await feedOf(worker, asya);

    expect(titles(denisFeed.upcoming)).toEqual([]);
    expect(denisFeed.activity.map(({ kind }) => kind)).toEqual(["joined", "joined"]);
    expect(titles(asyaFeed.upcoming)).toEqual(["Подарок"]);
    expect(asyaFeed.activity[0]).toMatchObject({
      kind: "task",
      title: "Сюрприз",
      memberName: "Ася",
    });
  });

  test("shows each author's Profile Picture as of their last login", async () => {
    const worker = await startWithFamily();
    const asyaPictured = { ...asya, photo_url: "https://t.me/i/userpic/320/asya.jpg" };

    const task = await addTask(worker, asyaPictured, {});

    await complete(worker, asyaPictured, { taskId: task.id });

    const feed = await feedOf(worker, denis);

    expect(
      feed.activity.map(({ memberName, memberPicture }) => [memberName, memberPicture]),
    ).toEqual([
      ["Ася", "https://t.me/i/userpic/320/asya.jpg"],
      ["Ася", "https://t.me/i/userpic/320/asya.jpg"],
      ["Денис", null],
    ]);
  });

  test("shows one line per completed Occurrence of a recurring Task", async () => {
    const worker = await startWithFamily();
    const task = await addTask(worker, denis, {
      title: "Таблетка Бьюику",
      when: on("2026-09-24"),
      recurrence: { frequency: "weekly", until: null },
      assigneeIds: [worker.asyaId],
    });

    worker.clock.set("2026-10-01T10:00:00Z");
    await complete(worker, asya, { taskId: task.id, occurrence: "2026-09-24" });
    worker.clock.set("2026-10-01T11:00:00Z");
    await complete(worker, asya, { taskId: task.id, occurrence: "2026-10-01" });

    const feed = await feedOf(worker, denis);

    expect(feed.activity.filter(({ kind }) => kind === "task").map(({ at }) => at)).toEqual([
      Date.parse("2026-10-01T11:00:00Z"),
      Date.parse("2026-10-01T10:00:00Z"),
    ]);
  });

  test("shows a Task completed by its last Subtask as one line", async () => {
    const worker = await startWithFamily();
    const task = await addTask(worker, denis, {});
    let withSubtasks = task;

    for (const title of ["Купить обои", "Поклеить"]) {
      const response = await request(worker, denis, {
        method: "POST",
        path: `/api/tasks/${task.id}/subtasks`,
        body: { title },
      });

      withSubtasks = await response.json<Task>();
    }

    const [first, last] = withSubtasks.subtasks;

    worker.clock.set("2026-10-01T10:00:00Z");
    await request(worker, asya, {
      method: "POST",
      path: `/api/tasks/${task.id}/subtasks/${first?.id}/complete`,
    });
    worker.clock.set("2026-10-01T11:00:00Z");
    await request(worker, denis, {
      method: "POST",
      path: `/api/tasks/${task.id}/subtasks/${last?.id}/complete`,
    });

    const feed = await feedOf(worker, denis);

    expect(
      feed.activity
        .filter(({ kind }) => kind === "task")
        .map((item) => [item.kind === "task" && item.title, item.memberName]),
    ).toEqual([
      ["Ремонт", "Денис"],
      ["Ремонт: Купить обои", "Ася"],
    ]);
  });

  // 35 entries go through the whole Worker one by one, which takes a while on a busy machine.
  test("pages older Activity by 30", async () => {
    const worker = await startWithFamily();
    const buick = await addBuick(worker);

    for (let minute = 10; minute < 45; minute += 1) {
      worker.clock.set(`2026-10-01T10:${minute}:00Z`);
      await addEntry(worker, buick.id, { kind: "weight", weightKg: 30 });
    }

    const first = await feedOf(worker, denis);
    const second = await feedOf(worker, denis, first.next ?? "");

    expect(first.activity).toHaveLength(30);
    expect(first.activity[0]).toMatchObject({ kind: "care", title: "Вес: 30 кг — Бьюик" });
    expect(second.activity.map(({ kind }) => kind)).toEqual([
      "care",
      "care",
      "care",
      "care",
      "care",
      "joined",
      "joined",
    ]);
    expect(second).toMatchObject({ overdue: [], upcoming: [], next: null });
  }, 30_000);
});
