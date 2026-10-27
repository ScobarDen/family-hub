import { describe, expect, test } from "vite-plus/test";

import type { FeedPage, Task, TaskChange, TaskList, TaskWhen } from "@family-hub/contract";

import { type TelegramUserFixture } from "./init-data.ts";
import { asya, denis, request, startWorker } from "./worker-harness.ts";

const vika = { id: 333, first_name: "Вика" };

async function bodyOf<Body>(response: Promise<Response>): Promise<Body> {
  const settled = await response;

  return settled.json<Body>();
}

async function startWithFamily() {
  const worker = startWorker({ now: "2026-10-04T09:00:00Z" });
  const { familyId, ownerId } = await worker.addFamily({
    name: "Гущины",
    owner: { telegramId: denis.id, name: "Денис" },
  });
  const asyaId = await worker.addMember(familyId, { telegramId: asya.id, name: "Ася" });

  return Object.assign(worker, { familyId, denisId: ownerId, asyaId });
}

type Worker = Awaited<ReturnType<typeof startWithFamily>>;

function on(date: string, time: string | null = null): TaskWhen {
  return {
    date,
    time,
    timeZone: time === null ? null : "Europe/Moscow",
    endDate: null,
    endTime: null,
  };
}

async function send(
  worker: Worker,
  user: TelegramUserFixture,
  { method = "POST", path, body }: { method?: string; path: string; body?: unknown },
) {
  return request(worker, user, { method, path, body });
}

async function createTask(worker: Worker, change: TaskChange, user = denis): Promise<Task> {
  const response = await send(worker, user, { path: "/api/tasks", body: change });

  return response.json<Task>();
}

async function tasksOf(worker: Worker, user: TelegramUserFixture): Promise<TaskList> {
  const response = await send(worker, user, { method: "GET", path: "/api/tasks" });

  return response.json<TaskList>();
}

async function feedOf(worker: Worker, user: TelegramUserFixture): Promise<FeedPage> {
  const response = await send(worker, user, { method: "GET", path: "/api/feed" });

  return response.json<FeedPage>();
}

async function mark(
  worker: Worker,
  {
    taskId,
    occurrence,
    action = "complete",
  }: { taskId: string; occurrence: string | null; action?: string },
  user = denis,
) {
  const response = await send(worker, user, {
    path: `/api/tasks/${taskId}/${action}`,
    body: { occurrence },
  });

  return response.json<Task>();
}

describe("a Task", () => {
  test("needs only a title and comes back with defaults", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, { title: "Купить пылесос" });

    expect(task).toMatchObject({
      title: "Купить пылесос",
      when: null,
      recurrence: null,
      assignees: [],
      recipients: "default",
      reminderOffsets: [],
      visibility: "shared",
      isOwn: true,
      completions: [],
      subtasks: [],
    });
    expect(await tasksOf(worker, asya)).toHaveLength(1);
  });

  test("keeps a time, its zone, an end and several Assignees", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, {
      title: "Стоматолог",
      when: { ...on("2026-10-08", "15:00"), endTime: "17:00" },
      assigneeIds: [worker.denisId, worker.asyaId],
    });

    expect(task.when).toEqual({
      date: "2026-10-08",
      time: "15:00",
      timeZone: "Europe/Moscow",
      endDate: null,
      endTime: "17:00",
    });
    expect(task.assignees.map(({ name }) => name)).toEqual(["Ася", "Денис"]);
  });

  test("refuses a change the contract does not accept", async () => {
    const worker = await startWithFamily();
    const response = await send(worker, denis, {
      path: "/api/tasks",
      body: { title: "Таблетка Бьюику", recurrence: { frequency: "weekly", until: null } },
    });

    expect(await response.json()).toMatchObject({ code: "INVALID_REQUEST" });
  });

  test("refuses an Assignee from outside the Family", async () => {
    const worker = await startWithFamily();
    const response = await send(worker, denis, {
      path: "/api/tasks",
      body: { title: "Вынести мусор", assigneeIds: ["stranger"] },
    });

    expect(await response.json()).toMatchObject({ code: "ASSIGNEE_NOT_ALLOWED" });
  });

  test("is deleted only by its owner", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, { title: "Купить пылесос" });
    const byAsya = await send(worker, asya, { method: "DELETE", path: `/api/tasks/${task.id}` });
    const byDenis = await send(worker, denis, { method: "DELETE", path: `/api/tasks/${task.id}` });

    expect(byAsya.status).toBe(403);
    expect(byDenis.status).toBe(200);
    expect(await tasksOf(worker, denis)).toEqual([]);
  });
});

describe("completing a Task", () => {
  test("by any Member completes it for all its Assignees and can be undone", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, {
      title: "Вынести мусор",
      assigneeIds: [worker.denisId, worker.asyaId],
    });
    const done = await mark(worker, { taskId: task.id, occurrence: null }, asya);

    expect(done.completions).toEqual([{ occurrence: null, at: worker.clock.now(), by: "Ася" }]);

    const reopened = await mark(worker, { taskId: task.id, occurrence: null, action: "reopen" });

    expect(reopened.completions).toEqual([]);
  });

  test("keeps a single dated Task done when its date moves", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, { title: "Отпуск", when: on("2026-10-10") });

    await mark(worker, { taskId: task.id, occurrence: "2026-10-10" });

    const moved = await send(worker, denis, {
      method: "PUT",
      path: `/api/tasks/${task.id}`,
      body: { title: "Отпуск", when: on("2026-10-12") },
    });

    const movedTask = await moved.json<Task>();

    expect(movedTask.completions).toHaveLength(1);
  });

  test("of a recurring Task completes one Occurrence at a time", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, {
      title: "Таблетка Бьюику",
      when: on("2026-10-01"),
      recurrence: { frequency: "weekly", until: null },
      assigneeIds: [worker.asyaId],
    });
    const done = await mark(worker, { taskId: task.id, occurrence: "2026-10-01" });

    expect(done.completions.map(({ occurrence }) => occurrence)).toEqual(["2026-10-01"]);
  });

  test("of a recurring Task reopens one Occurrence and leaves the others done", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, {
      title: "Таблетка Бьюику",
      when: on("2026-10-01"),
      recurrence: { frequency: "weekly", until: null },
    });

    await mark(worker, { taskId: task.id, occurrence: "2026-10-01" });
    await mark(worker, { taskId: task.id, occurrence: "2026-10-08" });

    const reopened = await mark(worker, {
      taskId: task.id,
      occurrence: "2026-10-08",
      action: "reopen",
    });

    expect(reopened.completions.map(({ occurrence }) => occurrence)).toEqual(["2026-10-01"]);
  });

  test("reopens an Occurrence nobody completed without a change", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, {
      title: "Таблетка Бьюику",
      when: on("2026-10-01"),
      recurrence: { frequency: "weekly", until: null },
    });
    const reopened = await mark(worker, {
      taskId: task.id,
      occurrence: "2026-10-08",
      action: "reopen",
    });

    expect(reopened.completions).toEqual([]);
  });

  test.each([
    ["no date", { action: "complete", body: { occurrence: null } }],
    ["a date between its Occurrences", { action: "complete", body: { occurrence: "2026-10-02" } }],
    ["a date between its Occurrences to skip", { action: "skip", body: { date: "2026-10-02" } }],
  ])("of a recurring Task refuses %s", async (_case, { action, body }) => {
    const worker = await startWithFamily();
    const task = await createTask(worker, {
      title: "Таблетка Бьюику",
      when: on("2026-10-01"),
      recurrence: { frequency: "weekly", until: null },
    });
    const response = await send(worker, denis, { path: `/api/tasks/${task.id}/${action}`, body });

    const [unchanged] = await tasksOf(worker, denis);

    expect(await response.json()).toMatchObject({ code: "OCCURRENCE_NOT_FOUND" });
    expect(unchanged).toMatchObject({ completions: [], skippedDates: [] });
  });

  test("refuses to skip the one Occurrence of a single Task", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, { title: "Отпуск", when: on("2026-10-10") });
    const response = await send(worker, denis, {
      path: `/api/tasks/${task.id}/skip`,
      body: { date: "2026-10-10" },
    });

    expect(await response.json()).toMatchObject({ code: "OCCURRENCE_NOT_FOUND" });
  });
});

describe("Overdue", () => {
  test("comes only to a past Occurrence of a Task with Assignees, in words of the Feed", async () => {
    const worker = await startWithFamily();

    await createTask(worker, { title: "ДР Аси", when: on("2026-10-01") });
    await createTask(worker, {
      title: "Вынести мусор",
      when: on("2026-10-02"),
      assigneeIds: [worker.asyaId],
    });

    const { overdue } = await feedOf(worker, denis);

    expect(overdue.map(({ title }) => title)).toEqual(["Вынести мусор"]);
  });

  test("leaves a Completed or skipped Occurrence of a recurring Task alone", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, {
      title: "Таблетка Бьюику",
      when: on("2026-09-20"),
      recurrence: { frequency: "weekly", until: null },
      assigneeIds: [worker.asyaId],
    });

    await mark(worker, { taskId: task.id, occurrence: "2026-09-20" });
    await send(worker, denis, { path: `/api/tasks/${task.id}/skip`, body: { date: "2026-09-27" } });

    const { overdue, upcoming } = await feedOf(worker, denis);

    expect(overdue.map(({ date }) => date)).toEqual([]);
    expect(upcoming.map(({ date }) => date).slice(0, 2)).toEqual(["2026-10-04", "2026-10-11"]);
  });
});

describe("an edit of a recurring Task", () => {
  test("applies to every Occurrence", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, {
      title: "Полить цветы",
      when: on("2026-10-05"),
      recurrence: { frequency: "weekly", until: null },
    });

    await send(worker, denis, {
      method: "PUT",
      path: `/api/tasks/${task.id}`,
      body: {
        title: "Полить цветы",
        when: on("2026-10-06"),
        recurrence: { frequency: "weekly", until: "2026-10-19" },
      },
    });

    const { upcoming } = await feedOf(worker, denis);

    expect(upcoming.map(({ date }) => date)).toEqual(["2026-10-06", "2026-10-13"]);
  });

  test("refuses Subtasks", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, {
      title: "Полить цветы",
      when: on("2026-10-05"),
      recurrence: { frequency: "weekly", until: null },
    });
    const subtask = await send(worker, denis, {
      path: `/api/tasks/${task.id}/subtasks`,
      body: { title: "Кактус" },
    });

    expect(await subtask.json()).toMatchObject({ code: "SUBTASKS_NOT_ALLOWED" });
  });

  test("into a single one starts it afresh, without the Occurrences done before", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, {
      title: "Вынести мусор",
      when: on("2026-09-28"),
      recurrence: { frequency: "weekly", until: null },
      assigneeIds: [worker.asyaId],
    });

    await mark(worker, { taskId: task.id, occurrence: "2026-09-28" });

    const edited = await send(worker, denis, {
      method: "PUT",
      path: `/api/tasks/${task.id}`,
      body: { title: "Вынести мусор", when: on("2026-10-01"), assigneeIds: [worker.asyaId] },
    });
    const { overdue } = await feedOf(worker, denis);

    expect(await edited.json()).toMatchObject({ recurrence: null, completions: [] });
    expect(overdue.map(({ title }) => title)).toEqual(["Вынести мусор"]);
  });
});

describe("Subtasks", () => {
  test("complete their Task once the last one is ticked and reopen it when one is not", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, { title: "Собраться в отпуск" });
    const withOne = await bodyOf<Task>(
      send(worker, denis, {
        path: `/api/tasks/${task.id}/subtasks`,
        body: { title: "Паспорта", assigneeIds: [worker.asyaId] },
      }),
    );
    const [step] = withOne.subtasks;
    const path = `/api/tasks/${task.id}/subtasks/${step?.id ?? ""}`;
    const done = await bodyOf<Task>(send(worker, asya, { path: `${path}/complete` }));

    expect(done.completions).toHaveLength(1);

    const reopened = await bodyOf<Task>(send(worker, asya, { path: `${path}/reopen` }));

    expect(reopened.completions).toEqual([]);
  });

  test("stop a Task from becoming recurring", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, { title: "Собраться в отпуск", when: on("2026-10-10") });

    await send(worker, denis, {
      path: `/api/tasks/${task.id}/subtasks`,
      body: { title: "Паспорта" },
    });

    const response = await send(worker, denis, {
      method: "PUT",
      path: `/api/tasks/${task.id}`,
      body: {
        title: "Собраться в отпуск",
        when: on("2026-10-10"),
        recurrence: { frequency: "yearly", until: null },
      },
    });

    expect(response.status).toBe(409);
  });
});

describe("a Private Task", () => {
  test("exists only for its owner", async () => {
    const worker = await startWithFamily();

    await createTask(worker, { title: "Подарок Асе", visibility: "private" });

    expect(await tasksOf(worker, asya)).toEqual([]);
    expect(await tasksOf(worker, denis)).toHaveLength(1);
  });

  test("takes no one else as Assignee", async () => {
    const worker = await startWithFamily();
    const response = await send(worker, denis, {
      path: "/api/tasks",
      body: { title: "Сюрприз", visibility: "private", assigneeIds: [worker.asyaId] },
    });

    expect(await response.json()).toMatchObject({ code: "ASSIGNEE_NOT_ALLOWED" });
  });

  test("never comes back from Shared", async () => {
    const worker = await startWithFamily();
    const task = await createTask(worker, { title: "Купить пылесос" });
    const response = await send(worker, denis, {
      method: "PUT",
      path: `/api/tasks/${task.id}`,
      body: { title: "Купить пылесос", visibility: "private" },
    });

    expect(response.status).toBe(409);
  });
});

describe("a Member who leaves", () => {
  test("stops being an Assignee", async () => {
    const worker = await startWithFamily();
    const vikaId = await worker.addMember(worker.familyId, { telegramId: vika.id, name: "Вика" });
    const task = await createTask(worker, { title: "Вынести мусор", assigneeIds: [vikaId] });

    await send(worker, vika, { path: "/api/family/leave" });

    const [kept] = await tasksOf(worker, denis);

    expect(kept?.id).toBe(task.id);
    expect(kept?.assignees).toEqual([]);
  });
});
