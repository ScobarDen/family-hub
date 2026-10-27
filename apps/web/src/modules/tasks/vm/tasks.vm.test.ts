import { atom, context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import {
  occurrenceTarget,
  skipTarget,
  subtaskChange,
  taskChange,
  type FamilyMemberList,
  type Person,
  type Pet,
  type Task,
} from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import type { TaskRow } from "../task-rows.lib.ts";
import { createTasksApi } from "../tasks.api.ts";
import type { CareRecord } from "./task-actions.vm.ts";
import { reatomTasksScreen } from "./tasks.vm.ts";

const denis: Person = { id: "member-1", name: "Денис", profilePicture: null };
const asya: Person = { id: "member-2", name: "Ася", profilePicture: null };

const members: FamilyMemberList = [
  { ...denis, isFamilyOwner: true },
  { ...asya, isFamilyOwner: false },
];

const buick: Pet = {
  id: "pet-1",
  name: "Бьюик",
  species: "dog",
  breed: null,
  sex: null,
  birthDate: "2022-10-20",
  chipNumber: null,
  notes: null,
  archivedAt: null,
  memo: { food: null, clinic: null, important: null, updatedAt: null, updatedBy: null },
  avatar: null,
};

const doneAt = Date.parse("2026-10-05T18:30:00Z");

function taskOf(fields: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    note: null,
    when: null,
    recurrence: null,
    skippedDates: [],
    assignees: [],
    recipients: "default",
    reminderOffsets: [],
    visibility: "shared",
    isOwn: true,
    pet: null,
    album: null,
    completions: [],
    subtasks: [],
    ...fields,
  };
}

function onDate(date: string): Task["when"] {
  return { date, time: null, timeZone: null, endDate: null, endTime: null };
}

const vaccination = taskOf({
  id: "task-vaccination",
  title: "Прививка Бьюику",
  when: onDate("2026-10-12"),
  assignees: [asya],
  pet: { id: "pet-1", name: "Бьюик", picture: null },
});

const food = taskOf({
  id: "task-food",
  title: "Купить корм",
  when: {
    date: "2026-10-16",
    time: "19:00",
    timeZone: "Europe/Moscow",
    endDate: null,
    endTime: null,
  },
  assignees: [denis],
  reminderOffsets: ["1h"],
});

const repair = taskOf({ id: "task-repair", title: "Ремонт", when: onDate("2026-10-20") });

const vacation = taskOf({ id: "task-vacation", title: "Отпуск" });

const passport = taskOf({
  id: "task-passport",
  title: "Паспорт",
  completions: [{ occurrence: null, at: doneAt, by: "Денис" }],
});

const cleaning = taskOf({
  id: "task-cleaning",
  title: "Уборка",
  when: onDate("2026-10-02"),
  recurrence: { frequency: "weekly", until: null },
  assignees: [asya],
});

type Sent = { request: string; body: unknown };

type Route = (body: unknown, ids: { taskId: string; subtaskId: string }) => unknown;

function completedSubtask(task: Task, subtaskId: string): Task {
  const subtasks = task.subtasks.map((each) =>
    each.id === subtaskId ? { ...each, completed: { at: doneAt, by: "Денис" } } : each,
  );
  const isAllDone = subtasks.every(({ completed }) => completed !== null);

  return {
    ...task,
    subtasks,
    completions: isAllDone ? [{ occurrence: null, at: doneAt, by: "Денис" }] : task.completions,
  };
}

function patternOf(request: string) {
  const [, taskId = "", subtaskId = ""] =
    /^\w+ \/api\/tasks\/([^/]+)(?:\/subtasks\/([^/]+))?/u.exec(request) ?? [];
  const pattern = request
    .replace(`/subtasks/${subtaskId}`, "/subtasks/:sub")
    .replace(`/tasks/${taskId}`, "/tasks/:id");

  return { pattern, ids: { taskId, subtaskId } };
}

function fakeBackend(
  initial: Task[] = [vaccination, food, repair, vacation, passport],
  { failing }: { failing?: string } = {},
) {
  let tasks = initial;
  const sent: Sent[] = [];

  function saved(taskId: string, change: (task: Task) => Task): Task {
    tasks = tasks.map((each) => (each.id === taskId ? change(each) : each));

    return tasks.find(({ id }) => id === taskId) ?? vacation;
  }

  const routes: Record<string, Route> = {
    "GET /api/tasks": () => tasks,
    "GET /api/albums": () => [],
    "POST /api/tasks": (body) => {
      const change = taskChange.parse(body);

      return taskOf({ ...change, id: "task-new", recipients: "default", assignees: [] });
    },
    "POST /api/tasks/:id/complete": (body, { taskId }) =>
      saved(taskId, (task) => ({
        ...task,
        completions: [
          ...task.completions,
          {
            occurrence: occurrenceTarget.parse(body).occurrence,
            at: doneAt,
            by: "Денис",
          },
        ],
      })),
    "POST /api/tasks/:id/reopen": (body, { taskId }) =>
      saved(taskId, (task) => ({
        ...task,
        completions: task.completions.filter(
          ({ occurrence }) => occurrence !== occurrenceTarget.parse(body).occurrence,
        ),
      })),
    "POST /api/tasks/:id/skip": (body, { taskId }) =>
      saved(taskId, (task) => ({
        ...task,
        skippedDates: [...task.skippedDates, skipTarget.parse(body).date],
      })),
    "POST /api/tasks/:id/subtasks": (body, { taskId }) =>
      saved(taskId, (task) => {
        const { title, date } = subtaskChange.parse(body);

        return {
          ...task,
          subtasks: [
            ...task.subtasks,
            { id: `sub-${task.subtasks.length + 1}`, title, date, assignees: [], completed: null },
          ],
        };
      }),
    "POST /api/tasks/:id/subtasks/:sub/complete": (_body, { taskId, subtaskId }) =>
      saved(taskId, (task) => completedSubtask(task, subtaskId)),
  };

  async function fetch(url: URL, init: RequestInit): Promise<Response> {
    const request = `${init.method ?? "GET"} ${url.pathname}`;
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    const { pattern, ids } = patternOf(request);
    const route = routes[pattern];

    sent.push({ request, body });

    if (failing === pattern) {
      return Response.json({ code: "INTERNAL", message: "" }, { status: 500 });
    }

    return route === undefined
      ? Response.json({ code: "TASK_NOT_FOUND", message: "" }, { status: 404 })
      : Response.json(route(body, ids));
  }

  return { fetch, sent };
}

function fakeTelegram(choices: string[] = []) {
  const pending = [...choices];

  return {
    async showPopup() {
      return pending.shift();
    },
  };
}

function startTasks(backend = fakeBackend(), telegram = fakeTelegram()) {
  const client = createHttpClient({ baseUrl: "https://api.family-hub.test", fetch: backend.fetch });
  const recorded: CareRecord[] = [];
  const openedPets: string[] = [];
  const openedAlbums: string[] = [];
  const model = reatomTasksScreen({
    api: createTasksApi(client),
    members: { data: atom(members) },
    pets: { data: atom([buick]) },
    telegram,
    liveVersion: atom(0),
    self: () => "member-1",
    viewer: () => ({ timeZone: "Europe/Moscow", today: "2026-10-16" }),
    onOpenAlbum: (albumId) => {
      openedAlbums.push(albumId);
    },
    onOpenPet: (petId) => {
      openedPets.push(petId);
    },
    onRecord: (record) => {
      recorded.push(record);
    },
    onDraftSaved: noop,
  });

  model.screen.subscribe(noop);

  return { model, backend, recorded, openedPets, openedAlbums };
}

type Model = ReturnType<typeof startTasks>["model"];

async function loaded(model: Model) {
  await vi.waitFor(() => {
    expect(model.screen().kind).toBe("list");
  });
}

async function settled(model: Model) {
  await vi.waitFor(() => {
    expect(model.isChanging()).toBe(false);
  });
}

function groups(model: Model) {
  const screen = model.screen();

  if (screen.kind !== "list") {
    throw new Error(`The list is not shown: ${screen.kind}`);
  }

  return screen.groups;
}

function rowOf(model: Model, title: string, occurrence: string | null = null): TaskRow {
  const row = Object.values(groups(model))
    .flat()
    .find(
      (each): each is TaskRow =>
        each.kind === "task" &&
        each.title === title &&
        (occurrence === null || each.occurrence === occurrence),
    );

  if (row === undefined) {
    throw new Error(`No row ${title}`);
  }

  return row;
}

beforeEach(() => {
  context.reset();
});

describe("the list of Tasks", () => {
  test("groups the Tasks by when they are due and folds the Completed ones", async () => {
    const { model } = startTasks();

    await loaded(model);

    expect(model.screen()).toMatchObject({
      kind: "list",
      groups: {
        overdue: [{ title: "Прививка Бьюику", status: "overdue" }],
        today: [{ title: "Купить корм", hasReminder: true }],
        upcoming: [
          { kind: "task", title: "Ремонт" },
          { kind: "birthday", title: "День рождения: Бьюик, 4 года", when: "20 октября" },
        ],
        undated: [{ title: "Отпуск", date: undefined }],
        completed: [{ title: "Паспорт", status: "completed" }],
      },
      isCompletedShown: false,
    });

    model.toggleCompleted();

    expect(model.screen()).toMatchObject({ isCompletedShown: true });
  });

  test("never calls a past Task without Assignees Overdue", async () => {
    const { model } = startTasks(fakeBackend([{ ...vaccination, assignees: [] }]));

    await loaded(model);

    expect(groups(model).overdue).toEqual([]);
  });

  test("shows under «Мои» only the Tasks the Member does or is reminded of", async () => {
    const { model } = startTasks();

    await loaded(model);
    model.showScope("mine");

    expect(groups(model)).toMatchObject({
      overdue: [],
      today: [{ title: "Купить корм" }],
      upcoming: [{ kind: "birthday" }],
      undated: [],
      completed: [],
    });

    model.showScope("all");

    expect(groups(model).overdue).toHaveLength(1);
  });
});

describe("completing a Task", () => {
  test("completes with one tap and takes it back from the undo bar", async () => {
    const { model, backend } = startTasks();

    await loaded(model);
    model.toggle(rowOf(model, "Отпуск"));
    await settled(model);

    expect(groups(model).completed.map(({ title }) => title)).toContain("Отпуск");
    expect(model.undo()).toMatchObject({
      taskId: "task-vacation",
      title: "Отпуск",
      petId: undefined,
    });

    model.undoCompletion();
    await settled(model);

    expect(backend.sent.map(({ request }) => request)).toContain(
      "POST /api/tasks/task-vacation/reopen",
    );
    expect(groups(model).undated).toMatchObject([{ title: "Отпуск" }]);
    expect(model.undo()).toBeUndefined();
  });

  test("offers to record a Pet's Task in its journal from the undo bar", async () => {
    const { model, recorded } = startTasks();

    await loaded(model);
    model.toggle(rowOf(model, "Прививка Бьюику"));
    await settled(model);

    expect(model.undo()).toMatchObject({ petId: "pet-1" });

    model.recordCareEntry();

    expect(recorded).toEqual([{ petId: "pet-1", title: "Прививка Бьюику" }]);
    expect(model.undo()).toBeUndefined();
  });

  test("completes one Occurrence of a recurring Task on its own", async () => {
    const { model, backend } = startTasks(fakeBackend([cleaning]));

    await loaded(model);

    expect(groups(model)).toMatchObject({
      overdue: [{ occurrence: "2026-10-02" }, { occurrence: "2026-10-09" }],
      today: [{ occurrence: "2026-10-16" }],
      upcoming: [{ kind: "birthday" }, { occurrence: "2026-10-23" }],
    });

    model.toggle(rowOf(model, "Уборка", "2026-10-16"));
    await settled(model);

    expect(backend.sent.at(-1)).toEqual({
      request: "POST /api/tasks/task-cleaning/complete",
      body: { occurrence: "2026-10-16" },
    });
    expect(groups(model)).toMatchObject({
      overdue: [{ occurrence: "2026-10-02" }, { occurrence: "2026-10-09" }],
      today: [],
      completed: [{ occurrence: "2026-10-16" }],
    });
  });

  test("skips one Occurrence of a recurring Task after asking", async () => {
    const { model, backend } = startTasks(fakeBackend([cleaning]), fakeTelegram(["confirm"]));

    await loaded(model);
    model.openRow(rowOf(model, "Уборка", "2026-10-09"));

    expect(model.screen()).toMatchObject({ kind: "task", task: { isRecurring: true } });

    model.skipOccurrence();
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("list");
    });

    expect(backend.sent.at(-1)).toEqual({
      request: "POST /api/tasks/task-cleaning/skip",
      body: { date: "2026-10-09" },
    });
    expect(groups(model).overdue).toMatchObject([{ occurrence: "2026-10-02" }]);
  });

  test("completes the bot's «Записать» Occurrence quietly and opens the Pet's journal", async () => {
    const { model, backend, recorded } = startTasks();

    model.recordOccurrence({ taskId: "task-vaccination", occurrence: "2026-10-12" });
    await vi.waitFor(() => {
      expect(recorded).toEqual([{ petId: "pet-1", title: "Прививка Бьюику" }]);
    });

    expect(backend.sent.map(({ request }) => request)).toContain(
      "POST /api/tasks/task-vaccination/complete",
    );
    expect(model.undo()).toBeUndefined();
  });

  test("does nothing on «Записать» for a Task without a Pet", async () => {
    const { model, backend, recorded } = startTasks();

    model.recordOccurrence({ taskId: "task-repair", occurrence: "2026-10-20" });
    await settled(model);

    expect(backend.sent.map(({ request }) => request)).toEqual(["GET /api/tasks"]);
    expect(recorded).toEqual([]);
  });

  test("says so when «Записать» cannot complete the Occurrence", async () => {
    const { model, recorded } = startTasks(
      fakeBackend(undefined, { failing: "POST /api/tasks/:id/complete" }),
    );

    model.recordOccurrence({ taskId: "task-vaccination", occurrence: "2026-10-12" });
    await settled(model);

    expect(model.failure()).toBe("Не получилось сохранить. Попробуйте ещё раз.");
    expect(recorded).toEqual([]);
  });

  test("stops waiting on «Записать» when the list cannot load", async () => {
    const { model, recorded } = startTasks(fakeBackend(undefined, { failing: "GET /api/tasks" }));

    model.recordOccurrence({ taskId: "task-vaccination", occurrence: "2026-10-12" });
    await settled(model);

    expect(model.screen().kind).toBe("failed");
    expect(recorded).toEqual([]);
  });

  test("keeps a completion made while the list was refetching", async () => {
    const backend = fakeBackend();
    let release = noop;
    let isHolding = false;
    const held = {
      ...backend,
      fetch: async (url: URL, init: RequestInit) => {
        const answer = backend.fetch(url, init);

        if (isHolding && url.pathname === "/api/tasks" && init.method === undefined) {
          isHolding = false;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }

        return answer;
      },
    };
    const { model } = startTasks(held);

    await loaded(model);
    isHolding = true;
    model.reload();
    model.toggle(rowOf(model, "Отпуск"));
    await settled(model);
    release();

    await vi.waitFor(() => {
      expect(groups(model).undated).toEqual([]);
    });
    expect(groups(model).completed.map(({ title }) => title)).toContain("Отпуск");
  });
});

describe("opening a Task by its id", () => {
  test("waits for the list and opens a recurring Task on its next open Occurrence", async () => {
    const { model, backend } = startTasks(fakeBackend([cleaning]));

    model.open("task-cleaning");
    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({ kind: "task", task: { occurrence: "2026-10-02" } });
    });

    model.toggleOpened();
    await settled(model);

    expect(backend.sent.at(-1)).toEqual({
      request: "POST /api/tasks/task-cleaning/complete",
      body: { occurrence: "2026-10-02" },
    });
  });
});

describe("Subtasks", () => {
  test("adds a Subtask to an open Task and counts the steps", async () => {
    const { model } = startTasks();

    await loaded(model);
    model.open("task-vacation");
    model.addSubtask();
    model.subtaskForm.form.fields.title.set("Купить билеты");
    model.subtaskForm.save();

    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({
        kind: "task",
        task: { stepsTitle: "Шаги · 0 из 1", subtasks: [{ title: "Купить билеты" }] },
      });
    });
  });

  test("completes the Task once its last Subtask is completed", async () => {
    const steps: Task["subtasks"] = [
      { id: "sub-1", title: "Билеты", date: null, assignees: [], completed: null },
      { id: "sub-2", title: "Отель", date: null, assignees: [], completed: null },
    ];
    const { model } = startTasks(fakeBackend([{ ...vacation, subtasks: steps }]));

    await loaded(model);
    model.open("task-vacation");
    model.toggleSubtask("sub-1");
    await settled(model);

    expect(model.screen()).toMatchObject({
      task: { stepsTitle: "Шаги · 1 из 2", completed: undefined },
    });

    model.toggleSubtask("sub-2");
    await settled(model);

    expect(model.screen()).toMatchObject({
      task: { stepsTitle: "Шаги · 2 из 2", completed: expect.stringContaining("Выполнено") },
    });
  });

  test("offers no Subtasks on a recurring Task", async () => {
    const { model } = startTasks(fakeBackend([cleaning]));

    await loaded(model);
    model.open("task-cleaning");

    expect(model.screen()).toMatchObject({ kind: "task", task: { canAddSubtask: false } });
  });
});

describe("a Private Task", () => {
  test("keeps only its owner among the people and is saved Private", async () => {
    const { model, backend } = startTasks();

    await loaded(model);
    model.add();
    model.taskForm.form.fields.title.set("Подарок Асе");
    model.taskForm.toggleAssignee("member-2");
    model.taskForm.chooseVisibility("private");

    expect(model.taskForm.assignees().map(({ id }) => id)).toEqual(["member-1"]);

    model.taskForm.save();
    await vi.waitFor(() => {
      expect(model.screen()).toMatchObject({ kind: "task", task: { isPrivate: true } });
    });

    expect(backend.sent.find(({ request }) => request === "POST /api/tasks")?.body).toMatchObject({
      visibility: "private",
      assigneeIds: [],
    });
  });
});

describe("a Task's Album", () => {
  test("shows the Album strip and opens the Album", async () => {
    const trip = taskOf({
      id: "task-trip",
      title: "Поездка в Казань",
      album: { id: "album-1", title: "Казань", photos: [], photoCount: 0 },
    });
    const { model, openedAlbums } = startTasks(fakeBackend([trip]));

    await loaded(model);
    model.open("task-trip");

    expect(model.screen()).toMatchObject({
      kind: "task",
      task: { album: { id: "album-1", title: "Казань" } },
    });

    model.openAlbum("album-1");

    expect(openedAlbums).toEqual(["album-1"]);
  });
});

describe("the Task form", () => {
  test("shows only the title and the date on «+»", async () => {
    const { model } = startTasks();

    await loaded(model);
    model.add();

    expect(model.screen()).toEqual({ kind: "task-form", isCreating: true });
    expect(model.taskForm.isExpanded()).toBe(false);
    expect(model.taskForm.form.fields.date()).toBe("");

    model.taskForm.expand();

    expect(model.taskForm.isExpanded()).toBe(true);
  });

  test("opens expanded for a Pet and on edit", async () => {
    const { model } = startTasks();

    await loaded(model);
    model.addForPet("pet-1");

    expect(model.taskForm.isExpanded()).toBe(true);
    expect(model.taskForm.form.fields.petId()).toBe("pet-1");

    model.open("task-food");
    model.edit();

    expect(model.taskForm.isExpanded()).toBe(true);
    expect(model.taskForm.form.fields.time()).toBe("19:00");
  });

  test("offers only day-sized Reminders without a time", async () => {
    const { model } = startTasks();

    await loaded(model);
    model.add();
    model.taskForm.form.fields.date.set("2026-10-20");

    expect(model.taskForm.offsets().map(({ offset }) => offset)).toEqual(["at-start", "1d", "1w"]);

    model.taskForm.form.fields.time.set("10:00");

    expect(model.taskForm.offsets()).toHaveLength(5);
  });

  test("drops the Reminders of a Task left without a date", async () => {
    const { model, backend } = startTasks();

    await loaded(model);
    model.add();
    model.taskForm.form.fields.title.set("Позвонить маме");
    model.taskForm.form.fields.date.set("2026-10-20");
    model.taskForm.toggleOffset("1d");
    model.taskForm.form.fields.date.set("");
    model.taskForm.save();
    await vi.waitFor(() => {
      expect(model.screen().kind).toBe("task");
    });

    expect(backend.sent.find(({ request }) => request === "POST /api/tasks")?.body).toMatchObject({
      title: "Позвонить маме",
      when: null,
      reminderOffsets: [],
    });
  });
});

describe("the calendar", () => {
  test("lists a day's Tasks beside a Pet's birthday and opens the Pet from it", async () => {
    const { model, openedPets } = startTasks();

    await loaded(model);
    model.showView("calendar");

    expect(model.screen()).toEqual({ kind: "calendar" });

    model.select("2026-10-20");

    expect(model.dayRows().map(({ item }) => item.title)).toEqual([
      "Ремонт",
      "День рождения: Бьюик, 4 года",
    ]);

    const birthday = model.dayRows().find(({ item }) => item.kind === "birthday");

    if (birthday !== undefined) {
      model.openItem(birthday.item);
    }

    expect(openedPets).toEqual(["pet-1"]);
  });

  test("remembers the list or the calendar for the next opening", async () => {
    const first = startTasks();

    expect(first.model.view()).toBe("list");

    first.model.showView("calendar");

    const second = startTasks();

    expect(second.model.view()).toBe("calendar");
  });
});
